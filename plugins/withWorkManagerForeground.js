const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withWorkManagerForeground(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    
    // Ensure the tools namespace is declared on the manifest tag
    config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // Ensure application service array exists
    mainApplication.service = mainApplication.service || [];

    // Find if the WorkManager SystemForegroundService is already defined in the local manifest configuration
    const wmServiceIndex = mainApplication.service.findIndex(
      (s) => s.$['android:name'] === 'androidx.work.impl.background.systemforeground.SystemForegroundService'
    );

    const serviceDeclaration = {
      $: {
        'android:name': 'androidx.work.impl.background.systemforeground.SystemForegroundService',
        'android:exported': 'false',
        'android:foregroundServiceType': 'phoneCall',
        'tools:node': 'merge',
        'tools:replace': 'android:foregroundServiceType'
      }
    };

    if (wmServiceIndex > -1) {
      mainApplication.service[wmServiceIndex] = serviceDeclaration;
    } else {
      mainApplication.service.push(serviceDeclaration);
    }

    return config;
  });
};
