window.onload = function() {
		var fileInput = document.getElementById('fileInput');
		fileInput.addEventListener('change', function(e) {
			var file = fileInput.files[0];
			
			
			var reader = new FileReader();

			reader.onload = function(e) {
				programCodeMirror.setValue(reader.result);
			}
			reader.readAsText(file);
			
		});
}
