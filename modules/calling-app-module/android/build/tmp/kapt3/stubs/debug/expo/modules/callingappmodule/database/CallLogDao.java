package expo.modules.callingappmodule.database;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000*\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\t\n\u0002\b\u0002\bg\u0018\u00002\u00020\u0001J\u0010\u0010\u0002\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u0005H\'J\u000e\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\b0\u0007H\'J\u0016\u0010\t\u001a\b\u0012\u0004\u0012\u00020\b0\u00072\u0006\u0010\u0004\u001a\u00020\u0005H\'J\u0010\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\bH\'\u00a8\u0006\r"}, d2 = {"Lexpo/modules/callingappmodule/database/CallLogDao;", "", "deleteLogsForCampaign", "", "campaignId", "", "getAllLogs", "", "Lexpo/modules/callingappmodule/database/CallLogEntity;", "getLogsForCampaign", "insertLog", "", "log", "calling-app-module_debug"})
@androidx.room.Dao()
public abstract interface CallLogDao {
    
    @androidx.room.Insert(onConflict = 1)
    public abstract long insertLog(@org.jetbrains.annotations.NotNull()
    expo.modules.callingappmodule.database.CallLogEntity log);
    
    @androidx.room.Query(value = "SELECT * FROM call_logs WHERE campaignId = :campaignId ORDER BY callStartTime DESC")
    @org.jetbrains.annotations.NotNull()
    public abstract java.util.List<expo.modules.callingappmodule.database.CallLogEntity> getLogsForCampaign(int campaignId);
    
    @androidx.room.Query(value = "SELECT * FROM call_logs ORDER BY callStartTime DESC")
    @org.jetbrains.annotations.NotNull()
    public abstract java.util.List<expo.modules.callingappmodule.database.CallLogEntity> getAllLogs();
    
    @androidx.room.Query(value = "DELETE FROM call_logs WHERE campaignId = :campaignId")
    public abstract void deleteLogsForCampaign(int campaignId);
}