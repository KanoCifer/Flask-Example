document.addEventListener("DOMContentLoaded", () => {
  const genderInputs = document.querySelectorAll<HTMLInputElement>(
    'input[name="gender"]',
  );
  let previousValue: string | null = null;

  const checkedInput = document.querySelector<HTMLInputElement>(
    'input[name="gender"]:checked',
  );
  if (checkedInput) {
    previousValue = checkedInput.value;
  }

  genderInputs.forEach((input) => {
    input.addEventListener("click", function (this: HTMLInputElement) {
      if (this.value === previousValue) {
        this.checked = false;
        previousValue = null;
      } else {
        previousValue = this.value;
      }
    });
  });
});
