package expo.modules.callingappmodule;

@kotlin.Metadata(mv = {2, 1, 0}, k = 1, xi = 48, d1 = {"\u00004\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\u0018\u00002\u00020\u0001B\u0007\u00a2\u0006\u0004\b\u0002\u0010\u0003J\b\u0010\u0014\u001a\u00020\u0015H\u0016R\u0014\u0010\u0004\u001a\u00020\u00058BX\u0082\u0004\u00a2\u0006\u0006\u001a\u0004\b\u0006\u0010\u0007R\u001b\u0010\b\u001a\u00020\t8BX\u0082\u0084\u0002\u00a2\u0006\f\n\u0004\b\f\u0010\r\u001a\u0004\b\n\u0010\u000bR\u0010\u0010\u000e\u001a\u0004\u0018\u00010\u000fX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0010\u001a\u0004\u0018\u00010\u0011X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0012\u001a\u0004\u0018\u00010\u0013X\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u0016"}, d2 = {"Lexpo/modules/callingappmodule/CallingAppModule;", "Lexpo/modules/kotlin/modules/Module;", "<init>", "()V", "context", "Landroid/content/Context;", "getContext", "()Landroid/content/Context;", "db", "Lexpo/modules/callingappmodule/database/AppDatabase;", "getDb", "()Lexpo/modules/callingappmodule/database/AppDatabase;", "db$delegate", "Lkotlin/Lazy;", "recorder", "Landroid/media/MediaRecorder;", "currentRecordingPath", "", "localPlayer", "Landroid/media/MediaPlayer;", "definition", "Lexpo/modules/kotlin/modules/ModuleDefinitionData;", "calling-app-module_debug"})
public final class CallingAppModule extends expo.modules.kotlin.modules.Module {
    @org.jetbrains.annotations.NotNull()
    private final kotlin.Lazy db$delegate = null;
    @org.jetbrains.annotations.Nullable()
    private android.media.MediaRecorder recorder;
    @org.jetbrains.annotations.Nullable()
    private java.lang.String currentRecordingPath;
    @org.jetbrains.annotations.Nullable()
    private android.media.MediaPlayer localPlayer;
    
    public CallingAppModule() {
        super();
    }
    
    private final android.content.Context getContext() {
        return null;
    }
    
    private final expo.modules.callingappmodule.database.AppDatabase getDb() {
        return null;
    }
    
    @java.lang.Override()
    @org.jetbrains.annotations.NotNull()
    public expo.modules.kotlin.modules.ModuleDefinitionData definition() {
        return null;
    }
}