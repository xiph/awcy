function load_aws() {
  $.getJSON('/describeAutoScalingInstances',function(data) {
    var table = $('#machineinfo');
    table.html('');
    data.AutoScalingInstances.forEach(function(instance) {
      var instance_row = $('<tr>');
      var instance_id = $('<td>');
      instance_id.html(instance.InstanceId);
      instance_row.append(instance_id);
      instance_row.append($('<td>').html(instance.HealthStatus));
      instance_row.append($('<td>').html(instance.LifecycleState));
      table.append(instance_row);
    });
  });
  $.getJSON('/describeAutoScalingGroups',function(data) {
    var group = data.AutoScalingGroups[0];
    var desired = group.DesiredCapacity;
    var actual = group.Instances.length;
    if (desired > 0) {
      $('#machine_status_text').html(actual+'/'+desired+' machines have started.');
    } else {
      $('#machine_status_text').html('All machines are currently offline.');
    }
  });
}
