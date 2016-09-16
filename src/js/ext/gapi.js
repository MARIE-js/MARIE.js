// Your Client ID can be retrieved from your project in the Google
      // Developer Console, https://console.developers.google.com
      var CLIENT_ID = '357044840397-qs7nu7a17ohiih95v334l6k209qh5oah.apps.googleusercontent.com';

      var SCOPES = ['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/plus.login'];

      /**
       * Check if current user has authorized this application.
       */
      function checkAuth() {
        gapi.auth.authorize(
          {
            'client_id': CLIENT_ID,
            'scope': SCOPES.join(' '),
            'immediate': true
          }, handleAuthResult);
      }

      /**
       * Handle response from authorization server.
       *
       * @param {Object} authResult Authorization result.
       */
      function handleAuthResult(authResult) {
        var authorizeDiv = document.getElementById('authorize-div');
        if (authResult && !authResult.error) {
          // Hide auth UI, then load client library.
          authorizeDiv.attr('hidden',false);
          loadDriveApi();
        } else {
          // Show auth UI, allowing the user to initiate authorization by
          // clicking authorize button.
          authorizeDiv.attr('hidden',true);
        }
      }

      /**
       * Initiate auth flow in response to user clicking authorize button.
       *
       * @param {Event} event Button click event.
       */
      function handleAuthClick(event) {
        gapi.auth.authorize(
          {client_id: CLIENT_ID, scope: SCOPES, immediate: false},
          handleAuthResult);
        return false;
      }

      /**
       * Load Drive API client library.
       */
      function loadDriveApi() {
        gapi.client.load('drive', 'v3', listFiles);
      }

      /**
       * Print files.
       */
      function listFiles() {
        var request = gapi.client.drive.files.list({
            'pageSize': 10,
            'fields': "nextPageToken, files(id, name)"
          });

          request.execute(function(resp) {
            appendPre('Files:');
            var files = resp.files;
            if (files && files.length > 0) {
              for (var i = 0; i < files.length; i++) {
                var file = files[i];
                appendPre(file.name + ' (' + file.id + ')');
              }
            } else {
              appendPre('No files found.');
            }
          });
      }

      /**
       * Append a pre element to the body containing the given message
       * as its text node.
       *
       * @param {string} message Text to be placed in pre element.
       */
      function appendPre(message) {
        var textContent = document.createTextNode(message + '\n');
        console.log(textContent);
      }

      function gapiAuthenticate(){
        gapi.auth2.init(
          {client_id: CLIENT_ID, scope: SCOPES, immediate: false},
          handleAuthResult);
        return false;
      }

      function getInfo(url){
        checkAuth();
        var xhr = new XMLHttpRequest();
        xhr.open("GET",url,false);
        xhr.send(null);
        return xhr.responseText;
      }

      $(document).load(function(){
        gapiAuthenticate();
        console.log(getInfo('https://www.googleapis.com/drive/v3/about'))
      })
