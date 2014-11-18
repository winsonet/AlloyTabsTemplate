exports.createView = function(args) {
  // Introduce a warning panel based on com.caffeinelab.titanium.notifications
  var view = Ti.UI.createView(args);
  var notifier_area = Ti.UI.createView({height: 0});
  var animation_duration = OS_IOS ? 2000 : 250; // bizarre. not sure why this was required to make the iOS animation work..
  var notifier = Alloy.createWidget('com.caffeinalab.titanium.notifications', {
    animationDuration: animation_duration,
    permanentlyVisible: true,
    view: notifier_area,
    icon: '/images/icon_warning.png' 
  });
  view.add(notifier_area);
  view.showingWarning = false;

  view.showWarning = function(message) {
    if(view.showingWarning) { return; }
    notifier_area.height = '65dp';
    notifier.show({
      message: message
    });
    view.showingWarning = true;
    
    setTimeout(function(){
      // Needed to preven the notification from dissapearing when the tab loses and then regains focus
      notifier_area.children[0].top = 0;
    }, animation_duration + 1);
  };

  view.hideWarning = function() {
    if(!view.showingWarning) { return; }
    notifier.hide();
    notifier_area.height = 0;
    view.showingWarning = false;
  };
  
  // Introduce a loading panel 
  var loading_panel = Alloy.createController('components/loading', {message: ''});
  var loading_view = loading_panel.getView();
  view.add(loading_view);
  
  view.showLoading = function(message){
    loading_panel.setMessage(message);
    loading_view.visible = true;
    loading_view.height = '100%';
  };
  
  view.hideLoading = function(){
    loading_view.visible = false;
    loading_view.height = 0;
  };

  // Allow controller to bind a collection to a ListView
  var list_view               = null,
      next_page               = null,
      last_update_time        = null,
      stale_seconds           = null,
      pull_to_refresh_control = null,
      performUpdateIfErrorFn  = null,
      refreshFn               = null;
    
  view.bindList = function(opts){
    if(list_view != null) { 
      alert("container list can only be bound once"); 
      return;
    }
    
    stale_seconds = opts.staleSeconds;
    list_view     = opts.listView;

    if(OS_IOS && opts.pullToRefresh == true) {
      pull_to_refresh_control = Alloy.createController('components/pull_to_refresh', {
        refresh_label: opts.refreshLabel,
        list_view:     list_view
      });
    }

    refreshFn = function(){
      opts.list.fetch({
        success: function(collection) {
          last_update_time = new Date();
          next_page = collection.next_page;
          view.hideLoading();
          view.hideWarning();
          if(pull_to_refresh_control != null) {
            pull_to_refresh_control.reset();
          }
        },
        error: function(model, message){
          last_update_time = null;
          console.log("chuck norris fetch error: " + message);
          view.hideLoading();
          view.showWarning(message);
          if(pull_to_refresh_control != null) {
            pull_to_refresh_control.reset();
          }
        }
      });
    };    

    if(pull_to_refresh_control != null) {
      pull_to_refresh_control.setRefreshFn(refreshFn);
      list_view.pullView = pull_to_refresh_control.getView();
      list_view.addEventListener('pull', pull_to_refresh_control.pullListener);
      list_view.addEventListener('pullend', pull_to_refresh_control.pullendListener);
    }
        
    performUpdateIfErrorFn = function(){
      if(view.showingWarning) {
        view.hideWarning();
        
        refreshFn();
      }
    };    

    Ti.App.addEventListener(NETWORK_ONLINE, performUpdateIfErrorFn);
    
    refreshFn();
  };

  // Call this guy when the parent window closes
  view.cleanup = function(){
    if(pull_to_refresh_control != null) {
      pull_to_refresh_control.cleanup();
      pull_to_refresh_control = null;
      refreshFn = null;
    }
  };

  view.updateListIfErrorOrStale = function(opts){
    if(list_view != null) {

      var now = new Date();
      var list_is_stale = last_update_time != null && stale_seconds != null && (
        last_update_time.getTime() + stale_seconds * 1000 < now.getTime()
      );

      if(view.showingWarning || list_is_stale) {
        view.hideWarning();
        
        refreshFn();
      }
    }
  };

  return view;
};