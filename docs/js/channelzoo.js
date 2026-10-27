document.addEventListener('DOMContentLoaded', function() {
    const checkboxes = document.querySelectorAll('input[name="channel"]');

    checkboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            const container = document.getElementById(this.value + '-container');
            if (this.checked) {
                container.style.display = 'flex';
            } else {
                container.style.display = 'none';
            }
        });
    });
});