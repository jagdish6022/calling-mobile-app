package expo.modules.callingappmodule.database;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0018\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0002\b\u0002\bg\u0018\u00002\u00020\u0001J\n\u0010\u0002\u001a\u0004\u0018\u00010\u0003H\'J\u0010\u0010\u0004\u001a\u00020\u00052\u0006\u0010\u0006\u001a\u00020\u0003H\'\u00a8\u0006\u0007"}, d2 = {"Lexpo/modules/callingappmodule/database/SettingsDao;", "", "getSettings", "Lexpo/modules/callingappmodule/database/SettingsEntity;", "insertOrUpdateSettings", "", "settings", "calling-app-module_debug"})
@androidx.room.Dao()
public abstract interface SettingsDao {
    
    @androidx.room.Insert(onConflict = 1)
    public abstract void insertOrUpdateSettings(@org.jetbrains.annotations.NotNull()
    expo.modules.callingappmodule.database.SettingsEntity settings);
    
    @androidx.room.Query(value = "SELECT * FROM settings WHERE id = 1")
    @org.jetbrains.annotations.Nullable()
    public abstract expo.modules.callingappmodule.database.SettingsEntity getSettings();
}