$('#task').on('change', function() {
  if ( $(this).val() == 'custom') {
    $('#custom_videos').removeClass('hidden');
  } else {
    $('#custom_videos').addClass('hidden');
  }
});
