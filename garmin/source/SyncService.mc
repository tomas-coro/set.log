using Toybox.Communications as Comm;
using Toybox.Lang as Lang;
using Toybox.PersistedContent as PersistedContent;
using Toybox.System as Sys;

class SyncService {

    private var _view;

    function initialize(view) {
        _view = view;
    }

    function _isConfigured() {
        return SyncConfig.SUPABASE_URL != null
            && SyncConfig.SUPABASE_URL.length() > 0
            && SyncConfig.SUPABASE_ANON_KEY != null
            && SyncConfig.SUPABASE_ANON_KEY.length() > 0;
    }

    function _headers() {
        return {
            "Content-Type" => Comm.REQUEST_CONTENT_TYPE_JSON,
            "apikey" => SyncConfig.SUPABASE_ANON_KEY,
            "Authorization" => "Bearer " + SyncConfig.SUPABASE_ANON_KEY
        };
    }

    function _pushHeaders() {
        return {
            "Content-Type" => Comm.REQUEST_CONTENT_TYPE_JSON,
            "apikey" => SyncConfig.SUPABASE_ANON_KEY,
            "Authorization" => "Bearer " + SyncConfig.SUPABASE_ANON_KEY,
            // PostgREST: nessun body di risposta dopo il salvataggio.
            // Evita che Connect IQ provi a parsare il valore JSON scalare/null della RPC.
            "Prefer" => "return=minimal"
        };
    }

    function pullWorkout() {
        if (!_isConfigured()) {
            _view.onRemoteWorkoutError(900);
            return;
        }

        var url = SyncConfig.SUPABASE_URL + "/rest/v1/rpc/garmin_pull_workout";
        var params = { "p_token" => SyncConfig.DEVICE_TOKEN };
        var options = {
            :method => Comm.HTTP_REQUEST_METHOD_POST,
            :headers => _headers(),
            :responseType => Comm.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };

        Comm.makeWebRequest(url, params, options, method(:_onPull));
    }

    function _onPull(code as Lang.Number, data as Null or Lang.Dictionary or Lang.String or PersistedContent.Iterator) as Void {
        if (code == 200 && data != null) {
            _view.onRemoteWorkout(data);
        } else {
            _view.onRemoteWorkoutError(code);
        }
    }

    function pushResult(payload) {
        if (!_isConfigured()) {
            _view.onResultPushed(900);
            return;
        }

        var url = SyncConfig.SUPABASE_URL + "/rest/v1/rpc/garmin_push_result";
        var params = {
            "p_token" => SyncConfig.DEVICE_TOKEN,
            "p_result" => payload
        };
        var options = {
            :method => Comm.HTTP_REQUEST_METHOD_POST,
            :headers => _pushHeaders()
            // V2.3.0AB: nessun responseType sul push.
            // La RPC salva correttamente il risultato ma può rispondere senza body;
            // forzare JSON fa restituire -400 a Connect IQ.
        };

        Comm.makeWebRequest(url, params, options, method(:_onPush));
    }

    function _onPush(code as Lang.Number, data as Null or Lang.Dictionary or Lang.String or PersistedContent.Iterator) as Void {
        Sys.println("SETLOG PUSH HTTP " + code.toString());
        if (data != null) {
            Sys.println("SETLOG PUSH RESPONSE: " + data.toString());
        }

        // V2.3.0AC: garmin_push_result viene effettivamente salvata su Supabase,
        // ma Connect IQ restituisce -400 quando non accetta il body della risposta.
        // È un falso negativo del parser della risposta, non del push.
        if (code == -400) {
            _view.onResultPushed(204);
            return;
        }

        _view.onResultPushed(code);
    }
}
