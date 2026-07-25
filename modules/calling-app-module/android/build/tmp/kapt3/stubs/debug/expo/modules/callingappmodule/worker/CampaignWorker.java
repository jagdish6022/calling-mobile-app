package expo.modules.callingappmodule.worker;

@kotlin.Metadata(mv = {2, 1, 0}, k = 1, xi = 48, d1 = {"\u0000\u0096\u0001\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\b\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\u0007\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0007\n\u0002\u0010\t\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\u0018\u0000 :2\u00020\u0001:\u0001:B\u0017\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\u0004\b\u0006\u0010\u0007J\u000e\u0010\u0016\u001a\u00020\u0017H\u0096@\u00a2\u0006\u0002\u0010\u0018J\u0016\u0010\u0019\u001a\u00020\u001a2\u0006\u0010\u001b\u001a\u00020\u001cH\u0082@\u00a2\u0006\u0002\u0010\u001dJ6\u0010\u001e\u001a\u00020\u001a2\u0006\u0010\u001f\u001a\u00020 2\u0006\u0010!\u001a\u00020\"2\u0006\u0010#\u001a\u00020$2\u0006\u0010%\u001a\u00020&2\u0006\u0010\'\u001a\u00020(H\u0082@\u00a2\u0006\u0002\u0010)J\b\u0010*\u001a\u00020\u001aH\u0002J\u0010\u0010+\u001a\u00020,2\u0006\u0010-\u001a\u00020&H\u0002J\b\u0010.\u001a\u00020\u001aH\u0002J\u0010\u0010/\u001a\u00020\u001a2\u0006\u00100\u001a\u00020&H\u0002J<\u00101\u001a\u0004\u0018\u0001H2\"\u0004\b\u0000\u001022\u0006\u00103\u001a\u0002042\u001c\u00105\u001a\u0018\b\u0001\u0012\n\u0012\b\u0012\u0004\u0012\u0002H207\u0012\u0006\u0012\u0004\u0018\u00010806H\u0082@\u00a2\u0006\u0002\u00109R\u000e\u0010\b\u001a\u00020\tX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\u000bX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\f\u001a\u00020\rX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000e\u001a\u00020\u000fX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0010\u001a\u0004\u0018\u00010\u0011X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0012\u001a\u0004\u0018\u00010\u0013X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0014\u001a\u0004\u0018\u00010\u0015X\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006;"}, d2 = {"Lexpo/modules/callingappmodule/worker/CampaignWorker;", "Landroidx/work/CoroutineWorker;", "context", "Landroid/content/Context;", "workerParams", "Landroidx/work/WorkerParameters;", "<init>", "(Landroid/content/Context;Landroidx/work/WorkerParameters;)V", "db", "Lexpo/modules/callingappmodule/database/AppDatabase;", "notificationManager", "Landroid/app/NotificationManager;", "telephonyManager", "Landroid/telephony/TelephonyManager;", "audioManager", "Landroid/media/AudioManager;", "telecomManager", "Landroid/telecom/TelecomManager;", "tts", "Landroid/speech/tts/TextToSpeech;", "mediaPlayer", "Landroid/media/MediaPlayer;", "doWork", "Landroidx/work/ListenableWorker$Result;", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "runCampaignLoop", "", "campaignId", "", "(ILkotlin/coroutines/Continuation;)Ljava/lang/Object;", "processCall", "campaign", "Lexpo/modules/callingappmodule/database/CampaignEntity;", "contact", "Lexpo/modules/callingappmodule/database/ContactEntity;", "autoEndCall", "", "ttsLanguage", "", "audioVolume", "", "(Lexpo/modules/callingappmodule/database/CampaignEntity;Lexpo/modules/callingappmodule/database/ContactEntity;ZLjava/lang/String;FLkotlin/coroutines/Continuation;)Ljava/lang/Object;", "cleanupResources", "createForegroundInfo", "Landroidx/work/ForegroundInfo;", "text", "createNotificationChannel", "showCompletedNotification", "campaignName", "withTimeoutOrNull", "T", "timeMillis", "", "block", "Lkotlin/Function1;", "Lkotlin/coroutines/Continuation;", "", "(JLkotlin/jvm/functions/Function1;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "Companion", "calling-app-module_debug"})
public final class CampaignWorker extends androidx.work.CoroutineWorker {
    @org.jetbrains.annotations.NotNull()
    private final expo.modules.callingappmodule.database.AppDatabase db = null;
    @org.jetbrains.annotations.NotNull()
    private final android.app.NotificationManager notificationManager = null;
    @org.jetbrains.annotations.NotNull()
    private final android.telephony.TelephonyManager telephonyManager = null;
    @org.jetbrains.annotations.NotNull()
    private final android.media.AudioManager audioManager = null;
    @org.jetbrains.annotations.Nullable()
    private final android.telecom.TelecomManager telecomManager = null;
    @org.jetbrains.annotations.Nullable()
    private android.speech.tts.TextToSpeech tts;
    @org.jetbrains.annotations.Nullable()
    private android.media.MediaPlayer mediaPlayer;
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String CHANNEL_ID = "campaign_worker_channel";
    private static final int NOTIFICATION_ID = 4242;
    @org.jetbrains.annotations.NotNull()
    public static final expo.modules.callingappmodule.worker.CampaignWorker.Companion Companion = null;
    
    public CampaignWorker(@org.jetbrains.annotations.NotNull()
    android.content.Context context, @org.jetbrains.annotations.NotNull()
    androidx.work.WorkerParameters workerParams) {
        super(null, null);
    }
    
    @java.lang.Override()
    @org.jetbrains.annotations.Nullable()
    public java.lang.Object doWork(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super androidx.work.ListenableWorker.Result> $completion) {
        return null;
    }
    
    private final java.lang.Object runCampaignLoop(int campaignId, kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
    
    private final java.lang.Object processCall(expo.modules.callingappmodule.database.CampaignEntity campaign, expo.modules.callingappmodule.database.ContactEntity contact, boolean autoEndCall, java.lang.String ttsLanguage, float audioVolume, kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
    
    private final void cleanupResources() {
    }
    
    private final androidx.work.ForegroundInfo createForegroundInfo(java.lang.String text) {
        return null;
    }
    
    private final void createNotificationChannel() {
    }
    
    private final void showCompletedNotification(java.lang.String campaignName) {
    }
    
    private final <T extends java.lang.Object>java.lang.Object withTimeoutOrNull(long timeMillis, kotlin.jvm.functions.Function1<? super kotlin.coroutines.Continuation<? super T>, ? extends java.lang.Object> block, kotlin.coroutines.Continuation<? super T> $completion) {
        return null;
    }
    
    @kotlin.Metadata(mv = {2, 1, 0}, k = 1, xi = 48, d1 = {"\u0000\u0018\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\b\n\u0000\b\u0086\u0003\u0018\u00002\u00020\u0001B\t\b\u0002\u00a2\u0006\u0004\b\u0002\u0010\u0003R\u000e\u0010\u0004\u001a\u00020\u0005X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0007X\u0082T\u00a2\u0006\u0002\n\u0000\u00a8\u0006\b"}, d2 = {"Lexpo/modules/callingappmodule/worker/CampaignWorker$Companion;", "", "<init>", "()V", "CHANNEL_ID", "", "NOTIFICATION_ID", "", "calling-app-module_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
    }
}