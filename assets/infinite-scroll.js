document.addEventListener("DOMContentLoaded", function () {
  var trigger = document.getElementById("load-more-trigger");
  var loadingEl = document.getElementById("loading");

  if (!trigger || !loadingEl) return;

  var page = 2;
  var loading = false;
  var exhausted = false;

  function buildUrl(p) {
    var params = new URLSearchParams(window.location.search);
    params.delete("page");
    params.append("page", p);
    return window.location.pathname + "?" + params.toString();
  }

  function isTriggerVisible() {
    var rect = trigger.getBoundingClientRect();
    return rect.top <= window.innerHeight + 400;
  }

  async function loadMoreProducts() {
    if (loading || exhausted) return;
    var container = document.querySelector(".product-grid");
    if (!container) return;

    loading = true;
    loadingEl.style.display = "block";

    try {
      var response = await fetch(buildUrl(page));
      var text = await response.text();
      var html = new DOMParser().parseFromString(text, "text/html");
      var newItems = html.querySelectorAll(".product-grid .lux-grid__item");

      if (newItems.length === 0) {
        exhausted = true;
        trigger.style.display = "none";
      } else {
        newItems.forEach(function (item) {
          container.appendChild(item);
        });
        page++;
      }
    } catch (e) {
      console.error("Infinite scroll error:", e);
    }

    loadingEl.style.display = "none";
    loading = false;

    // If trigger is still visible after appending, keep loading
    if (!exhausted && isTriggerVisible()) {
      loadMoreProducts();
    }
  }

  // Scroll listener as primary driver
  window.addEventListener("scroll", function () {
    if (!exhausted && !loading && isTriggerVisible()) {
      loadMoreProducts();
    }
  }, { passive: true });

  // IntersectionObserver as secondary (catches initial viewport case)
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        loadMoreProducts();
      }
    }, { rootMargin: "0px 0px 400px 0px" });
    observer.observe(trigger);
  }

  // Reset when Shopify facets/sort change the URL via pushState
  var _pushState = history.pushState.bind(history);
  history.pushState = function () {
    _pushState.apply(history, arguments);
    page = 2;
    loading = false;
    exhausted = false;
    trigger.style.display = "";
    loadingEl.style.display = "none";
  };
  window.addEventListener("popstate", function () {
    page = 2;
    loading = false;
    exhausted = false;
    trigger.style.display = "";
    loadingEl.style.display = "none";
  });
});
