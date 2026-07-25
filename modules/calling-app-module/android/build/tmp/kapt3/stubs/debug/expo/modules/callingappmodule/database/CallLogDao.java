package expo.modules.callingappmodule.database;

@kotlin.Metadata(mv = {2, 1, 0}, k = 1, xi = 48, d1 = {"\u0000*\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\t\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0000\bg\u0018\u00002\u00020\u0001J\u0010\u0010\u0002\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u0005H\'J\u0016\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\u00050\u00072\u0006\u0010\b\u001a\u00020\tH\'J\u000e\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u00050\u0007H\'J\u0010\u0010\u000b\u001a\u00020\f2\u0006\u0010\b\u001a\u00020\tH\'\u00a8\u0006\r"}, d2 = {"Lexpo/modules/callingappmodule/database/CallLogDao;", "", "insertLog", "", "log", "Lexpo/modules/callingappmodule/database/CallLogEntity;", "getLogsForCampaign", "", "campaignId", "", "getAllLogs", "deleteLogsForCampaign", "", "calling-app-module_debug"})
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