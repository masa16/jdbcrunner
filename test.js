var DEADLOCK_RETRY_LIMIT = 100;
var databaseProductName;
var isAutoCommit = false;

function init() {
    var conn = takeConnection();
    if (conn.getTransactionIsolation() != java.sql.Connection.TRANSACTION_SERIALIZABLE) {
        conn.setTransactionIsolation(java.sql.Connection.TRANSACTION_SERIALIZABLE);
        info(`conn.getTransactionIsolation()=${conn.getTransactionIsolation()} TRANSACTION_SERIALIZABLE=${java.sql.Connection.TRANSACTION_SERIALIZABLE}`);
    }
    if (getId() == 0) {
        putData("DatabaseProductName", getDatabaseProductName());
    }
}

function run() {
    for (var retry = 0; retry <= DEADLOCK_RETRY_LIMIT; retry++) {
        try {
            var param = random(1, 5);
            query("SELECT data FROM sample WHERE id = $int", param);
            commit();
            return;
        } catch (e) {
            if (isDeadlock(e)) {
                if (databaseProductName != "tsurugidb")
                    warn("[Agent " + getId() + "] " + e.javaException + getScriptStackTrace(e));
                rollback();
            } else {
                error(e + getScriptStackTrace(e));
            }
        }
    }
    error("The deadlock retry limit is reached.");
}

function isDeadlock(exception) {
    var javaException = exception.javaException;

    if (javaException instanceof java.sql.SQLException) {
        if (databaseProductName == "Oracle"
            && javaException.getErrorCode() == 60) {
            return true;
        } else if (databaseProductName == "MySQL"
            && javaException.getErrorCode() == 1213) {
            return true;
        } else if (databaseProductName == "PostgreSQL"
            && (javaException.getSQLState() == "40P01" || javaException.getSQLState() == "40001")) {
            //info(`---javaException.getSQLState()=${javaException.getSQLState()}---`);
            return true;
        } else if (databaseProductName == "tsurugidb") {
            //info(`---javaException.getErrorCode()=${javaException.getErrorCode()}---`);
            if (javaException.getErrorCode() == 204000
                || javaException.getErrorCode() == 202002) {
                return true;
            }
        } else {
            info(`---javaException.getSQLState()=${javaException.getSQLState()}---`);
            info(`---javaException.getErrorCode()=${javaException.getErrorCode()}---`);
            return false;
        }
    } else {
        info(`---javaException.getErrorCode()=${javaException.getErrorCode()}---`);
        return false;
    }
}
