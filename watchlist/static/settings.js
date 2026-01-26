"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const genderInputs = document.querySelectorAll('input[name="gender"]');
    let previousValue = null;
    const checkedInput = document.querySelector('input[name="gender"]:checked');
    if (checkedInput) {
        previousValue = checkedInput.value;
    }
    genderInputs.forEach((input) => {
        input.addEventListener("click", function () {
            if (this.value === previousValue) {
                this.checked = false;
                previousValue = null;
            }
            else {
                previousValue = this.value;
            }
        });
    });
});
