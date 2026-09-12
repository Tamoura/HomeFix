// Small progressive enhancements. Every page works without this script.
(function () {
  'use strict';

  // Confirmation prompts for destructive or irreversible actions.
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (form instanceof HTMLFormElement && form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
      event.preventDefault();
    }
  });

  // Mobile navigation toggle.
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Render server timestamps in the visitor's own time zone.
  var formatter;
  try {
    var intlTag = document.documentElement.getAttribute('data-intl') || undefined;
    formatter = new Intl.DateTimeFormat(intlTag, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (error) {
    formatter = null;
  }
  if (formatter) {
    document.querySelectorAll('time[data-local]').forEach(function (node) {
      var date = new Date(node.getAttribute('datetime'));
      if (!isNaN(date.getTime())) {
        node.textContent = formatter.format(date);
        node.title = date.toISOString();
      }
    });
  }

  // Show the specialty field only when registering as a technician.
  var registerForm = document.querySelector('[data-register-form]');
  if (registerForm) {
    var technicianOnly = registerForm.querySelector('[data-technician-only]');
    var update = function () {
      var role = registerForm.querySelector('input[name="role"]:checked');
      if (technicianOnly) technicianOnly.hidden = !(role && role.value === 'technician');
    };
    registerForm.querySelectorAll('input[name="role"]').forEach(function (input) {
      input.addEventListener('change', update);
    });
    update();
  }

  // Demo accounts: fill in the login form.
  document.querySelectorAll('[data-fill-login]').forEach(function (button) {
    button.addEventListener('click', function () {
      var email = document.getElementById('field-email');
      var password = document.getElementById('field-password');
      if (!email || !password) return;
      email.value = button.getAttribute('data-fill-login');
      password.value = button.getAttribute('data-fill-password');
      var form = email.closest('form');
      if (form && form.requestSubmit) form.requestSubmit();
      else if (form) form.submit();
    });
  });

  // Let success messages fade away on their own.
  var flash = document.querySelector('[data-flash].flash-success');
  if (flash) {
    window.setTimeout(function () {
      flash.style.transition = 'opacity 0.6s';
      flash.style.opacity = '0';
      window.setTimeout(function () { flash.remove(); }, 700);
    }, 8000);
  }
})();
