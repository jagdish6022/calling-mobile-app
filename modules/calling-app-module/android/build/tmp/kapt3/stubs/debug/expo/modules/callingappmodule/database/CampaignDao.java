package expo.modules.callingappmodule.database;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u00004\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0002\b\u0002\n\u0002\u0010\b\n\u0000\n\u0002\u0010\t\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0002\b\u0003\bg\u0018\u00002\u00020\u0001J\u0010\u0010\u0002\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u0005H\'J\u000e\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\u00050\u0007H\'J\u0012\u0010\b\u001a\u0004\u0018\u00010\u00052\u0006\u0010\t\u001a\u00020\nH\'J\u0010\u0010\u000b\u001a\u00020\f2\u0006\u0010\u0004\u001a\u00020\u0005H\'J\u0010\u0010\r\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u0005H\'J\u001a\u0010\u000e\u001a\u00020\u00032\u0006\u0010\t\u001a\u00020\n2\b\u0010\u000f\u001a\u0004\u0018\u00010\u0010H\'J\u0018\u0010\u0011\u001a\u00020\u00032\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u0012\u001a\u00020\u0010H\'\u00a8\u0006\u0013"}, d2 = {"Lexpo/modules/callingappmodule/database/CampaignDao;", "", "deleteCampaign", "", "campaign", "Lexpo/modules/callingappmodule/database/CampaignEntity;", "getAllCampaigns", "", "getCampaignById", "campaignId", "", "insertCampaign", "", "updateCampaign", "updateCampaignAudio", "audioFilePath", "", "updateCampaignStatus", "status", "calling-app-module_debug"})
@androidx.room.Dao()
public abstract interface CampaignDao {
    
    @androidx.room.Insert(onConflict = 1)
    public abstract long insertCampaign(@org.jetbrains.annotations.NotNull()
    expo.modules.callingappmodule.database.CampaignEntity campaign);
    
    @androidx.room.Update()
    public abstract void updateCampaign(@org.jetbrains.annotations.NotNull()
    expo.modules.callingappmodule.database.CampaignEntity campaign);
    
    @androidx.room.Delete()
    public abstract void deleteCampaign(@org.jetbrains.annotations.NotNull()
    expo.modules.callingappmodule.database.CampaignEntity campaign);
    
    @androidx.room.Query(value = "SELECT * FROM campaigns WHERE campaignId = :campaignId")
    @org.jetbrains.annotations.Nullable()
    public abstract expo.modules.callingappmodule.database.CampaignEntity getCampaignById(int campaignId);
    
    @androidx.room.Query(value = "SELECT * FROM campaigns ORDER BY createdAt DESC")
    @org.jetbrains.annotations.NotNull()
    public abstract java.util.List<expo.modules.callingappmodule.database.CampaignEntity> getAllCampaigns();
    
    @androidx.room.Query(value = "UPDATE campaigns SET status = :status WHERE campaignId = :campaignId")
    public abstract void updateCampaignStatus(int campaignId, @org.jetbrains.annotations.NotNull()
    java.lang.String status);
    
    @androidx.room.Query(value = "UPDATE campaigns SET audioFilePath = :audioFilePath WHERE campaignId = :campaignId")
    public abstract void updateCampaignAudio(int campaignId, @org.jetbrains.annotations.Nullable()
    java.lang.String audioFilePath);
}