package expo.modules.callingappmodule.database;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u00006\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\b\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0002\b\u0002\n\u0002\u0010\t\n\u0002\b\u0006\n\u0002\u0010\u000e\n\u0002\b\u0003\bg\u0018\u00002\u00020\u0001J\u0010\u0010\u0002\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u0005H\'J\u0010\u0010\u0006\u001a\u00020\u00032\u0006\u0010\u0007\u001a\u00020\u0005H\'J\u0012\u0010\b\u001a\u0004\u0018\u00010\t2\u0006\u0010\u0004\u001a\u00020\u0005H\'J\u0016\u0010\n\u001a\b\u0012\u0004\u0012\u00020\t0\u000b2\u0006\u0010\u0007\u001a\u00020\u0005H\'J\u0016\u0010\f\u001a\b\u0012\u0004\u0012\u00020\t0\u000b2\u0006\u0010\u0007\u001a\u00020\u0005H\'J\u0010\u0010\r\u001a\u00020\u000e2\u0006\u0010\u000f\u001a\u00020\tH\'J\u0016\u0010\u0010\u001a\u00020\u00032\f\u0010\u0011\u001a\b\u0012\u0004\u0012\u00020\t0\u000bH\'J\u0010\u0010\u0012\u001a\u00020\u00032\u0006\u0010\u000f\u001a\u00020\tH\'J\u0018\u0010\u0013\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u00052\u0006\u0010\u0014\u001a\u00020\u0015H\'J \u0010\u0016\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u00052\u0006\u0010\u0014\u001a\u00020\u00152\u0006\u0010\u0017\u001a\u00020\u0005H\'\u00a8\u0006\u0018"}, d2 = {"Lexpo/modules/callingappmodule/database/ContactDao;", "", "deleteContact", "", "contactId", "", "deleteContactsForCampaign", "campaignId", "getContactById", "Lexpo/modules/callingappmodule/database/ContactEntity;", "getContactsForCampaign", "", "getPendingContactsForCampaign", "insertContact", "", "contact", "insertContacts", "contacts", "updateContact", "updateContactStatus", "status", "", "updateContactStatusAndAttempts", "attempts", "calling-app-module_debug"})
@androidx.room.Dao()
public abstract interface ContactDao {
    
    @androidx.room.Insert(onConflict = 1)
    public abstract long insertContact(@org.jetbrains.annotations.NotNull()
    expo.modules.callingappmodule.database.ContactEntity contact);
    
    @androidx.room.Insert(onConflict = 1)
    public abstract void insertContacts(@org.jetbrains.annotations.NotNull()
    java.util.List<expo.modules.callingappmodule.database.ContactEntity> contacts);
    
    @androidx.room.Update()
    public abstract void updateContact(@org.jetbrains.annotations.NotNull()
    expo.modules.callingappmodule.database.ContactEntity contact);
    
    @androidx.room.Query(value = "DELETE FROM contacts WHERE contactId = :contactId")
    public abstract void deleteContact(int contactId);
    
    @androidx.room.Query(value = "SELECT * FROM contacts WHERE contactId = :contactId")
    @org.jetbrains.annotations.Nullable()
    public abstract expo.modules.callingappmodule.database.ContactEntity getContactById(int contactId);
    
    @androidx.room.Query(value = "SELECT * FROM contacts WHERE campaignId = :campaignId ORDER BY contactId ASC")
    @org.jetbrains.annotations.NotNull()
    public abstract java.util.List<expo.modules.callingappmodule.database.ContactEntity> getContactsForCampaign(int campaignId);
    
    @androidx.room.Query(value = "SELECT * FROM contacts WHERE campaignId = :campaignId AND status = \'PENDING\' ORDER BY contactId ASC")
    @org.jetbrains.annotations.NotNull()
    public abstract java.util.List<expo.modules.callingappmodule.database.ContactEntity> getPendingContactsForCampaign(int campaignId);
    
    @androidx.room.Query(value = "UPDATE contacts SET status = :status WHERE contactId = :contactId")
    public abstract void updateContactStatus(int contactId, @org.jetbrains.annotations.NotNull()
    java.lang.String status);
    
    @androidx.room.Query(value = "UPDATE contacts SET status = :status, attempts = :attempts WHERE contactId = :contactId")
    public abstract void updateContactStatusAndAttempts(int contactId, @org.jetbrains.annotations.NotNull()
    java.lang.String status, int attempts);
    
    @androidx.room.Query(value = "DELETE FROM contacts WHERE campaignId = :campaignId")
    public abstract void deleteContactsForCampaign(int campaignId);
}