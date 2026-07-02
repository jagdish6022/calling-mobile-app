package expo.modules.callingappmodule.database

import androidx.room.*

@Dao
interface CampaignDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertCampaign(campaign: CampaignEntity): Long

    @Update
    fun updateCampaign(campaign: CampaignEntity)

    @Delete
    fun deleteCampaign(campaign: CampaignEntity)

    @Query("SELECT * FROM campaigns WHERE campaignId = :campaignId")
    fun getCampaignById(campaignId: Int): CampaignEntity?

    @Query("SELECT * FROM campaigns ORDER BY createdAt DESC")
    fun getAllCampaigns(): List<CampaignEntity>

    @Query("UPDATE campaigns SET status = :status WHERE campaignId = :campaignId")
    fun updateCampaignStatus(campaignId: Int, status: String)

    @Query("UPDATE campaigns SET audioFilePath = :audioFilePath WHERE campaignId = :campaignId")
    fun updateCampaignAudio(campaignId: Int, audioFilePath: String?)
}

@Dao
interface ContactDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertContact(contact: ContactEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertContacts(contacts: List<ContactEntity>)

    @Update
    fun updateContact(contact: ContactEntity)

    @Query("DELETE FROM contacts WHERE contactId = :contactId")
    fun deleteContact(contactId: Int)

    @Query("SELECT * FROM contacts WHERE contactId = :contactId")
    fun getContactById(contactId: Int): ContactEntity?

    @Query("SELECT * FROM contacts WHERE campaignId = :campaignId ORDER BY contactId ASC")
    fun getContactsForCampaign(campaignId: Int): List<ContactEntity>

    @Query("SELECT * FROM contacts WHERE campaignId = :campaignId AND status = 'PENDING' ORDER BY contactId ASC")
    fun getPendingContactsForCampaign(campaignId: Int): List<ContactEntity>

    @Query("UPDATE contacts SET status = :status WHERE contactId = :contactId")
    fun updateContactStatus(contactId: Int, status: String)

    @Query("UPDATE contacts SET status = :status, attempts = :attempts WHERE contactId = :contactId")
    fun updateContactStatusAndAttempts(contactId: Int, status: String, attempts: Int)

    @Query("DELETE FROM contacts WHERE campaignId = :campaignId")
    fun deleteContactsForCampaign(campaignId: Int)
}

@Dao
interface CallLogDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertLog(log: CallLogEntity): Long

    @Query("SELECT * FROM call_logs WHERE campaignId = :campaignId ORDER BY callStartTime DESC")
    fun getLogsForCampaign(campaignId: Int): List<CallLogEntity>

    @Query("SELECT * FROM call_logs ORDER BY callStartTime DESC")
    fun getAllLogs(): List<CallLogEntity>

    @Query("DELETE FROM call_logs WHERE campaignId = :campaignId")
    fun deleteLogsForCampaign(campaignId: Int)
}

@Dao
interface SettingsDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insertOrUpdateSettings(settings: SettingsEntity)

    @Query("SELECT * FROM settings WHERE id = 1")
    fun getSettings(): SettingsEntity?
}
