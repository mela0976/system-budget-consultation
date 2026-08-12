(() => {
  "use strict";

  const config = window.MELA_CONFIG || {};
  const dialog = document.querySelector("#intake-dialog");
  const form = document.querySelector("#intake-form");
  const submissionTarget = document.querySelector(".submission-target");
  const steps = [...document.querySelectorAll(".form-step")];
  const nextButton = form.querySelector("[data-next]");
  const prevButton = form.querySelector("[data-prev]");
  const submitButton = form.querySelector("[data-submit]");
  const errorBox = form.querySelector("[data-form-error]");
  const result = form.querySelector("[data-form-result]");
  const progressBar = form.querySelector("[data-progress-bar]");
  const stepCount = form.querySelector("[data-step-count]");
  const stepLabel = form.querySelector("[data-step-label]");
  const summaryMain = dialog.querySelector("[data-summary-main]");
  const summaryBudget = dialog.querySelector("[data-summary-budget]");
  const stepLabels = ["想解決的問題", "目前進度", "預算與功能", "聯絡方式"];
  let currentStep = 0;
  let selectedBudget = "";
  let submissionPending = false;
  let submissionTimer;

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  const header = document.querySelector("[data-header]");
  const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 18);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));

  const setBudget = (budget) => {
    if (!budget) return;
    selectedBudget = budget;
    const input = form.querySelector(`[data-budget-value="${budget}"]`);
    if (input) input.checked = true;
    updateSummary();
  };

  const openDialog = (budget = "") => {
    resetForm(false);
    setBudget(budget);
    document.querySelector("#page-url").value = window.location.href;
    document.querySelector("#referrer").value = document.referrer;
    document.querySelector("#form-started-at").value = String(Date.now());
    document.querySelector("#lead-id").value = createLeadId();
    dialog.showModal();
    window.setTimeout(() => steps[0].querySelector("input")?.focus(), 120);
  };

  document.querySelectorAll(".js-open-intake").forEach((button) => {
    button.addEventListener("click", () => openDialog());
  });
  document.querySelectorAll("[data-budget]").forEach((button) => {
    button.addEventListener("click", () => openDialog(button.dataset.budget));
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  const showStep = (index) => {
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((step, stepIndex) => {
      const active = stepIndex === currentStep;
      step.hidden = !active;
      step.classList.toggle("is-active", active);
    });
    prevButton.hidden = currentStep === 0;
    nextButton.hidden = currentStep === steps.length - 1;
    submitButton.hidden = currentStep !== steps.length - 1;
    progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    stepCount.textContent = String(currentStep + 1).padStart(2, "0");
    stepLabel.textContent = stepLabels[currentStep];
    errorBox.textContent = "";
    steps[currentStep].querySelector("input, select, textarea")?.focus();
  };

  const validateStep = () => {
    const fields = [...steps[currentStep].querySelectorAll("input, select, textarea")];
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  };

  nextButton.addEventListener("click", () => {
    if (!validateStep()) return;
    showStep(currentStep + 1);
  });
  prevButton.addEventListener("click", () => showStep(currentStep - 1));

  form.addEventListener("change", updateSummary);

  function updateSummary() {
    const need = form.querySelector('input[name="primaryNeed"]:checked');
    const budget = form.querySelector('input[name="budget"]:checked');
    summaryMain.textContent = need?.value || "尚未選擇需求";
    summaryBudget.textContent = budget?.value || "預算待確認";
  }

  function hasContactMethod() {
    return ["email", "phone", "lineId"].some((name) => form.elements[name].value.trim());
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    errorBox.textContent = "";
    if (!validateStep()) return;
    if (!hasContactMethod()) {
      errorBox.textContent = "請至少留下 Email、電話或 LINE ID 其中一項。";
      return;
    }
    if (!config.formEndpoint) {
      errorBox.textContent = "通知服務尚未完成設定，請網站管理者先填入 Apps Script 網址。";
      return;
    }

    // Browser autofill sometimes populates off-screen anti-spam fields.
    // Clear both names so mixed old/new cached assets remain compatible.
    ["faxNumber", "companyWebsite"].forEach((name) => {
      const field = form.elements[name];
      if (field) field.value = "";
    });
    form.action = config.formEndpoint;
    submitButton.disabled = true;
    submitButton.firstChild.textContent = "正在送出… ";
    submissionPending = true;
    form.submit();
    submissionTimer = window.setTimeout(() => {
      if (submissionPending) {
        handleSubmissionResult("error", "通知服務回覆逾時，尚未確認送達。請稍後再試，或改用其他聯絡方式。");
      }
    }, 15000);
  });

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    const expectedLeadId = form.elements.leadId.value;
    if (!submissionPending || data.source !== "mela-inquiry" || data.leadId !== expectedLeadId) return;
    handleSubmissionResult(data.status, data.message);
  });

  function handleSubmissionResult(status, message = "") {
    window.clearTimeout(submissionTimer);
    submissionPending = false;
    submitButton.disabled = false;
    submitButton.firstChild.textContent = "送出需求健檢 ";

    if (status === "error") {
      errorBox.textContent = message || "送出時發生問題，請稍後再試。";
      return;
    }
    steps.forEach((step) => { step.hidden = true; });
    form.querySelector(".form-progress").hidden = true;
    form.querySelector(".form-actions").hidden = true;
    result.hidden = false;
    result.focus();
  }

  function resetForm(clearBudget = true) {
    window.clearTimeout(submissionTimer);
    submissionPending = false;
    form.reset();
    result.hidden = true;
    form.querySelector(".form-progress").hidden = false;
    form.querySelector(".form-actions").hidden = false;
    submitButton.disabled = false;
    if (clearBudget) selectedBudget = "";
    showStep(0);
    updateSummary();
  }

  function createLeadId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
})();
