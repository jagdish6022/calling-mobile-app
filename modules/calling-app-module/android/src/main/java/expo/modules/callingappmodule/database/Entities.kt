package expo.modules.callingappmodule.database

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ForeignKey
import androidx.room.Index

@Entity(tableName = "campaigns")
data class CampaignEntity(
    @PrimaryKey(autoGenerate = true) val campaignId: Int = 0,
    val campaignName: String,
    val audioFilePath: String? = null,
    val totalContacts: Int = 0,
    val delayBetweenCalls: Int = 10, // in seconds
    val retryCount: Int = 2,
    val status: String = "DRAFT", // DRAFT, RUNNING, PAUSED, COMPLETED
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "contacts",
    foreignKeys = [
        ForeignKey(
            entity = CampaignEntity::class,
            parentColumns = ["campaignId"],
            childColumns = ["campaignId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["campaignId"])]
)
data class ContactEntity(
    @PrimaryKey(autoGenerate = true) val contactId: Int = 0,
    val campaignId: Int,
    val customerName: String,
    val phoneNumber: String,
    val status: String = "PENDING", // PENDING, DIALING, COMPLETED, FAILED, BUSY, NO_ANSWER, REJECTED
    val attempts: Int = 0
)

@Entity(
    tableName = "call_logs",
    foreignKeys = [
        ForeignKey(
            entity = CampaignEntity::class,
            parentColumns = ["campaignId"],
            childColumns = ["campaignId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["campaignId"])]
)
data class CallLogEntity(
    @PrimaryKey(autoGenerate = true) val logId: Int = 0,
    val campaignId: Int,
    val contactId: Int,
    val customerName: String,
    val phoneNumber: String,
    val callStartTime: Long,
    val callEndTime: Long,
    val duration: Int, // in seconds
    val status: String, // COMPLETED, FAILED, BUSY, NO_ANSWER, REJECTED
    val audioPlayed: Boolean
)

@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val id: Int = 1, // Single-row settings
    val delayBetweenCalls: Int = 10, // in seconds
    val retryCount: Int = 2,
    val autoEndCall: Boolean = true,
    val ttsLanguage: String = "en-US",
    val audioVolume: Float = 1.0f
)
