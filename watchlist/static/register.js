function bindSendCode() {
  $("#send-code").click(function (event) {
    // 阻止默认表单提交行为
    event.preventDefault();

    // 保存按钮引用
    let that = $(this);

    // 获取电子邮件地址
    let email = $("#email").val();
    // 简单的前端验证：允许点号、加号，支持多级域名和长TLD
    let emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    // 禁用按钮以防止重复点击
    that.off("click");
    // 倒计时
    let countdown = 60;
    that.text(countdown + "s");

    let timer = setInterval(function () {
      countdown--;
      that.text(countdown + "s");
      if (countdown <= 0) {
        clearInterval(timer);
        that.text("Send Code");
        // 重新启用按钮
        bindSendCode();
      }
    }, 1000);

    // 发送 AJAX 请求到服务器
    $.ajax({
      url: "/email/code",
      type: "GET",
      contentType: "application/json",
      data: { email: email },
      success: function (response) {
        alert(response.message);
      },
      error: function (xhr) {
        const response = JSON.parse(xhr.responseText);
        alert("Error: " + response.message);
      },
    });
  });
}

$(function () {
  bindSendCode();
});
