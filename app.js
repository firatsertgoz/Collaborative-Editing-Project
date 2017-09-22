// IIFE keeps our variables private
// and gets executed immediately!
(function () {
  // make doc editable and focus
  var doc = document.getElementById('doc');
  doc.contentEditable = true;
  doc.focus();
})();
