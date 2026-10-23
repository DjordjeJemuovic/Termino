(function () {
  var script = document.currentScript;
  if (!script) return;
  var business = script.getAttribute("data-business");
  if (!business) return;
  var baseUrl = new URL(script.src).origin;
  var frame = document.createElement("iframe");
  frame.src = baseUrl + "/embed/" + encodeURIComponent(business);
  frame.title = "Online zakazivanje";
  frame.loading = "lazy";
  frame.style.width = "100%";
  frame.style.minHeight = "720px";
  frame.style.height = "820px";
  frame.style.border = "0";
  frame.style.borderRadius = "16px";
  frame.setAttribute("allow", "clipboard-write");
  window.addEventListener("message", function (event) {
    if (event.origin !== baseUrl || event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === "termino:resize" && Number.isFinite(event.data.height)) {
      frame.style.height = Math.max(600, Math.min(1800, event.data.height)) + "px";
    }
  });
  script.parentNode.insertBefore(frame, script.nextSibling);
})();
