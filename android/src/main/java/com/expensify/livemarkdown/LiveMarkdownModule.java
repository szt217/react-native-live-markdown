package com.expensify.livemarkdown;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.common.UIManagerType;

public class LiveMarkdownModule extends NativeLiveMarkdownModuleSpec {
  private NativeProxy mNativeProxy;
  public LiveMarkdownModule(ReactApplicationContext reactContext) {
    super(reactContext);

    this.mNativeProxy = new NativeProxy();
  }

  @Override
  public boolean install() {
    FabricUIManager uiManager =
      (FabricUIManager) UIManagerHelper.getUIManager(getReactApplicationContext(), UIManagerType.FABRIC);

    FabricUIManager customFabricUIManager = CustomFabricUIManager.create(uiManager);

    mNativeProxy.createCommitHook(uiManager, customFabricUIManager);

    return true;
  }
}
