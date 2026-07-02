package expo.modules.callingappmodule

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.work.*
import expo.modules.callingappmodule.database.*
import expo.modules.callingappmodule.worker.CampaignWorker
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.io.PrintWriter

class CallingAppModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

  private val db by lazy { AppDatabase.getDatabase(context) }
  private var recorder: android.media.MediaRecorder? = null
  private var currentRecordingPath: String? = null
  private var localPlayer: android.media.MediaPlayer? = null

  override fun definition() = ModuleDefinition {
    Name("CallingAppModule")

    // --- Campaign CRUD ---
    AsyncFunction("createCampaign") { campaignName: String, delay: Int, retry: Int ->
      val campaign = CampaignEntity(
        campaignName = campaignName,
        delayBetweenCalls = delay,
        retryCount = retry
      )
      val id = db.campaignDao().insertCampaign(campaign)
      mapOf(
        "campaignId" to id.toInt(),
        "campaignName" to campaign.campaignName,
        "audioFilePath" to (campaign.audioFilePath ?: ""),
        "totalContacts" to campaign.totalContacts,
        "delayBetweenCalls" to campaign.delayBetweenCalls,
        "retryCount" to campaign.retryCount,
        "status" to campaign.status,
        "createdAt" to campaign.createdAt
      )
    }

    AsyncFunction("getCampaigns") {
      db.campaignDao().getAllCampaigns().map { campaign ->
        mapOf(
          "campaignId" to campaign.campaignId,
          "campaignName" to campaign.campaignName,
          "audioFilePath" to (campaign.audioFilePath ?: ""),
          "totalContacts" to campaign.totalContacts,
          "delayBetweenCalls" to campaign.delayBetweenCalls,
          "retryCount" to campaign.retryCount,
          "status" to campaign.status,
          "createdAt" to campaign.createdAt
        )
      }
    }

    AsyncFunction("getCampaign") { campaignId: Int ->
      val campaign = db.campaignDao().getCampaignById(campaignId)
      if (campaign != null) {
        mapOf(
          "campaignId" to campaign.campaignId,
          "campaignName" to campaign.campaignName,
          "audioFilePath" to (campaign.audioFilePath ?: ""),
          "totalContacts" to campaign.totalContacts,
          "delayBetweenCalls" to campaign.delayBetweenCalls,
          "retryCount" to campaign.retryCount,
          "status" to campaign.status,
          "createdAt" to campaign.createdAt
        )
      } else {
        null
      }
    }

    AsyncFunction("deleteCampaign") { campaignId: Int ->
      val campaign = db.campaignDao().getCampaignById(campaignId)
      if (campaign != null) {
        campaign.audioFilePath?.let { path ->
          val file = File(path)
          if (file.exists()) {
            file.delete()
          }
        }
        db.campaignDao().deleteCampaign(campaign)
        true
      } else {
        false
      }
    }

    AsyncFunction("updateCampaignStatus") { campaignId: Int, status: String ->
      db.campaignDao().updateCampaignStatus(campaignId, status)
      true
    }

    AsyncFunction("updateCampaignAudio") { campaignId: Int, audioFilePath: String? ->
      db.campaignDao().updateCampaignAudio(campaignId, audioFilePath)
      true
    }

    // --- Contact CRUD ---
    AsyncFunction("addContact") { campaignId: Int, customerName: String, phoneNumber: String ->
      val contact = ContactEntity(
        campaignId = campaignId,
        customerName = customerName,
        phoneNumber = phoneNumber
      )
      val id = db.contactDao().insertContact(contact)
      val campaign = db.campaignDao().getCampaignById(campaignId)
      if (campaign != null) {
        val total = db.contactDao().getContactsForCampaign(campaignId).size
        db.campaignDao().updateCampaign(campaign.copy(totalContacts = total))
      }
      mapOf(
        "contactId" to id.toInt(),
        "campaignId" to contact.campaignId,
        "customerName" to contact.customerName,
        "phoneNumber" to contact.phoneNumber,
        "status" to contact.status,
        "attempts" to contact.attempts
      )
    }

    AsyncFunction("deleteContact") { contactId: Int ->
      val contact = db.contactDao().getContactById(contactId)
      if (contact != null) {
        db.contactDao().deleteContact(contactId)
        val campaignId = contact.campaignId
        val campaign = db.campaignDao().getCampaignById(campaignId)
        if (campaign != null) {
          val total = db.contactDao().getContactsForCampaign(campaignId).size
          db.campaignDao().updateCampaign(campaign.copy(totalContacts = total))
        }
        true
      } else {
        false
      }
    }

    AsyncFunction("getContacts") { campaignId: Int ->
      db.contactDao().getContactsForCampaign(campaignId).map { contact ->
        mapOf(
          "contactId" to contact.contactId,
          "campaignId" to contact.campaignId,
          "customerName" to contact.customerName,
          "phoneNumber" to contact.phoneNumber,
          "status" to contact.status,
          "attempts" to contact.attempts
        )
      }
    }

    AsyncFunction("importContactsCsv") { uriString: String, campaignId: Int ->
      var importedCount = 0
      try {
        val uri = Uri.parse(uriString)
        val inputStream = context.contentResolver.openInputStream(uri)
        if (inputStream != null) {
          val reader = BufferedReader(InputStreamReader(inputStream))
          val contactsToInsert = mutableListOf<ContactEntity>()
          var line = reader.readLine()
          
          var nameIndex = 0
          var phoneIndex = 1
          if (line != null) {
            val headers = line.split(",").map { it.trim().lowercase() }
            val nIdx = headers.indexOf("name")
            val pIdx = headers.indexOf("phone")
            if (nIdx != -1) nameIndex = nIdx
            if (pIdx != -1) phoneIndex = pIdx
          }

          line = reader.readLine()
          while (line != null) {
            val parts = line.split(",")
            if (parts.size > nameIndex && parts.size > phoneIndex) {
              val rawName = parts[nameIndex].trim()
              val rawPhone = parts[phoneIndex].trim().filter { it.isDigit() }
              
              if (rawName.isNotEmpty() && rawPhone.isNotEmpty() && rawPhone.length in 7..15) {
                val isDup = contactsToInsert.any { it.phoneNumber == rawPhone }
                if (!isDup) {
                  contactsToInsert.add(
                    ContactEntity(
                      campaignId = campaignId,
                      customerName = rawName,
                      phoneNumber = rawPhone
                    )
                  )
                }
              }
            }
            line = reader.readLine()
          }
          reader.close()
          inputStream.close()

          if (contactsToInsert.isNotEmpty()) {
            val existingPhones = db.contactDao().getContactsForCampaign(campaignId).map { it.phoneNumber }.toSet()
            val filteredInserts = contactsToInsert.filter { it.phoneNumber !in existingPhones }
            
            db.contactDao().insertContacts(filteredInserts)
            importedCount = filteredInserts.size

            val campaign = db.campaignDao().getCampaignById(campaignId)
            if (campaign != null) {
              val total = db.contactDao().getContactsForCampaign(campaignId).size
              db.campaignDao().updateCampaign(campaign.copy(totalContacts = total))
            }
          }
        }
      } catch (e: Exception) {
        e.printStackTrace()
      }
      importedCount
    }

    // --- CallLog APIs ---
    AsyncFunction("getLogs") { campaignId: Int ->
      db.callLogDao().getLogsForCampaign(campaignId).map { log ->
        mapOf(
          "logId" to log.logId,
          "campaignId" to log.campaignId,
          "contactId" to log.contactId,
          "customerName" to log.customerName,
          "phoneNumber" to log.phoneNumber,
          "callStartTime" to log.callStartTime,
          "callEndTime" to log.callEndTime,
          "duration" to log.duration,
          "status" to log.status,
          "audioPlayed" to log.audioPlayed
        )
      }
    }

    AsyncFunction("getAllLogs") {
      db.callLogDao().getAllLogs().map { log ->
        mapOf(
          "logId" to log.logId,
          "campaignId" to log.campaignId,
          "contactId" to log.contactId,
          "customerName" to log.customerName,
          "phoneNumber" to log.phoneNumber,
          "callStartTime" to log.callStartTime,
          "callEndTime" to log.callEndTime,
          "duration" to log.duration,
          "status" to log.status,
          "audioPlayed" to log.audioPlayed
        )
      }
    }

    AsyncFunction("exportLogsCsv") { campaignId: Int ->
      val logs = db.callLogDao().getLogsForCampaign(campaignId)
      val campaign = db.campaignDao().getCampaignById(campaignId)
      val campaignNameSanitized = (campaign?.campaignName ?: "campaign").replace(Regex("[^a-zA-Z0-9]"), "_")
      val fileName = "call_logs_${campaignNameSanitized}_${campaignId}.csv"
      val file = File(context.cacheDir, fileName)
      
      try {
        val writer = PrintWriter(file)
        writer.println("Name,Phone,Status,Duration")
        for (log in logs) {
          writer.println("${log.customerName},${log.phoneNumber},${log.status},${log.duration}")
        }
        writer.close()
      } catch (e: Exception) {
        e.printStackTrace()
      }
      Uri.fromFile(file).toString()
    }

    // --- Settings APIs ---
    AsyncFunction("getSettings") {
      val settings = db.settingsDao().getSettings() ?: SettingsEntity()
      mapOf(
        "delayBetweenCalls" to settings.delayBetweenCalls,
        "retryCount" to settings.retryCount,
        "autoEndCall" to settings.autoEndCall,
        "ttsLanguage" to settings.ttsLanguage,
        "audioVolume" to settings.audioVolume
      )
    }

    AsyncFunction("saveSettings") { delay: Int, retry: Int, autoEndCall: Boolean, ttsLanguage: String, audioVolume: Float ->
      val settings = SettingsEntity(
        delayBetweenCalls = delay,
        retryCount = retry,
        autoEndCall = autoEndCall,
        ttsLanguage = ttsLanguage,
        audioVolume = audioVolume
      )
      db.settingsDao().insertOrUpdateSettings(settings)
      true
    }

    // --- Permissions Handling ---
    AsyncFunction("checkPermissions") { ->
      val callPhone = ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
      val readPhone = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
      val recordAudio = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
      
      mapOf(
        "CALL_PHONE" to callPhone,
        "READ_PHONE_STATE" to readPhone,
        "RECORD_AUDIO" to recordAudio
      )
    }

    AsyncFunction("requestPermissions") { ->
      val activity = appContext.currentActivity
      if (activity != null) {
        val permissions = arrayOf(
          Manifest.permission.CALL_PHONE,
          Manifest.permission.READ_PHONE_STATE,
          Manifest.permission.RECORD_AUDIO
        )
        ActivityCompat.requestPermissions(activity, permissions, 101)
        true
      } else {
        false
      }
    }

    // --- WorkManager Control ---
    AsyncFunction("startCampaign") { campaignId: Int ->
      val workManager = WorkManager.getInstance(context)
      val data = Data.Builder()
        .putInt("campaignId", campaignId)
        .build()

      val workRequest = OneTimeWorkRequestBuilder<CampaignWorker>()
        .setInputData(data)
        .addTag("campaign_$campaignId")
        .build()

      workManager.enqueueUniqueWork(
        "campaign_worker_$campaignId",
        ExistingWorkPolicy.REPLACE,
        workRequest
      )
      true
    }

    AsyncFunction("pauseCampaign") { campaignId: Int ->
      db.campaignDao().updateCampaignStatus(campaignId, "PAUSED")
      true
    }

    AsyncFunction("stopCampaign") { campaignId: Int ->
      db.campaignDao().updateCampaignStatus(campaignId, "DRAFT")
      val workManager = WorkManager.getInstance(context)
      workManager.cancelUniqueWork("campaign_worker_$campaignId")
      true
    }

    AsyncFunction("resetCampaignContacts") { campaignId: Int ->
      val contacts = db.contactDao().getContactsForCampaign(campaignId)
      for (contact in contacts) {
        db.contactDao().updateContactStatusAndAttempts(contact.contactId, "PENDING", 0)
      }
      db.campaignDao().updateCampaignStatus(campaignId, "DRAFT")
      true
    }

    AsyncFunction("isCampaignWorkerRunning") { campaignId: Int ->
      val workManager = WorkManager.getInstance(context)
      val statuses = workManager.getWorkInfosForUniqueWork("campaign_worker_$campaignId").get()
      if (statuses.isNotEmpty()) {
        val state = statuses[0].state
        state == WorkInfo.State.RUNNING || state == WorkInfo.State.ENQUEUED
      } else {
        false
      }
    }

    AsyncFunction("recoverUnfinishedCampaigns") {
      val runningCampaigns = db.campaignDao().getAllCampaigns().filter { it.status == "RUNNING" }
      val workManager = WorkManager.getInstance(context)
      for (campaign in runningCampaigns) {
        val data = Data.Builder()
          .putInt("campaignId", campaign.campaignId)
          .build()

        val workRequest = OneTimeWorkRequestBuilder<CampaignWorker>()
          .setInputData(data)
          .addTag("campaign_${campaign.campaignId}")
          .build()

        workManager.enqueueUniqueWork(
          "campaign_worker_${campaign.campaignId}",
          ExistingWorkPolicy.KEEP,
          workRequest
        )
      }
      true
    }

    // --- Audio Recording APIs ---
    AsyncFunction("startRecording") { campaignId: Int ->
      val fileName = "recording_${campaignId}.m4a"
      val file = File(context.filesDir, fileName)
      currentRecordingPath = file.absolutePath

      recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        android.media.MediaRecorder(context)
      } else {
        @Suppress("DEPRECATION")
        android.media.MediaRecorder()
      }

      recorder?.apply {
        setAudioSource(android.media.MediaRecorder.AudioSource.MIC)
        setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC)
        setOutputFile(currentRecordingPath)
        prepare()
        start()
      }
      currentRecordingPath ?: ""
    }

    AsyncFunction("stopRecording") {
      try {
        recorder?.apply {
          stop()
          release()
        }
      } catch (e: Exception) {
        e.printStackTrace()
      }
      recorder = null
      val path = currentRecordingPath ?: ""
      currentRecordingPath = null
      path
    }

    AsyncFunction("playAudio") { filePath: String ->
      try {
        localPlayer?.release()
        localPlayer = android.media.MediaPlayer().apply {
          setDataSource(filePath)
          setOnCompletionListener {
            it.release()
            localPlayer = null
          }
          prepare()
          start()
        }
        true
      } catch (e: Exception) {
        e.printStackTrace()
        false
      }
    }

    AsyncFunction("stopAudio") {
      try {
        localPlayer?.apply {
          if (isPlaying) {
            stop()
          }
          release()
        }
      } catch (e: Exception) {
        e.printStackTrace()
      }
      localPlayer = null
      true
    }

    AsyncFunction("deleteAudio") { filePath: String ->
      try {
        val file = File(filePath)
        if (file.exists()) {
          file.delete()
        }
        true
      } catch (e: Exception) {
        e.printStackTrace()
        false
      }
    }
  }
}
