document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const resultContainer = document.getElementById("result-container");
  const previewImage = document.getElementById("preview-image");
  const urlInput = document.getElementById("url-input");
  const copyBtn = document.getElementById("copy-btn");
  const resetBtn = document.getElementById("reset-btn");
  const mainTitle = document.getElementById("main-title");
  const mainDesc = document.getElementById("main-desc");

  // 上传配置
  const UPLOAD_CONFIG = {
    // 直接上传地址（可能会有 CORS 问题）
    direct: "https://ipfs-relay.crossbell.io/upload",
    // 代理上传地址（需要在 Cloudflare Workers 部署 worker.js）
    proxy: "https://ifps-api.261770.xyz",
    // 当前使用的上传方式: 'direct' 或 'proxy'
    mode: "proxy",
  };

  gsap.to(app, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power4.out",
  });

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  ["dragleave", "dragend"].forEach((type) => {
    dropZone.addEventListener(type, () => {
      dropZone.classList.remove("drag-over");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  });

  function handleUpload(file) {
    if (file.size > 30 * 1024 * 1024) {
      alert("文件太大，请选择 30MB 以下的图片");
      return;
    }

    const tl = gsap.timeline({
      defaults: { duration: 0.6, ease: "expo.inOut" },
    });

    tl.to(dropZone, {
      autoAlpha: 0,
      y: -60,
      scale: 0.95,
      onComplete: () => {
        dropZone.classList.add("hidden");
        progressContainer.classList.remove("hidden");
        mainTitle.innerText = "正在处理...";
      },
    }).fromTo(
      progressContainer,
      { autoAlpha: 0, y: 60, scale: 1.05 },
      { autoAlpha: 1, y: 0, scale: 1 },
    );

    const formData = new FormData();
    formData.append("file", file);

    let fakeProgress = { val: 0 };
    const progressTween = gsap.to(fakeProgress, {
      val: 95,
      duration: 3,
      ease: "power1.out",
      onUpdate: () => updateProgress(fakeProgress.val),
    });

    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          if (data.status === "ok") {
            progressTween.kill();
            gsap.to(fakeProgress, {
              val: 100,
              duration: 0.4,
              onUpdate: () => updateProgress(fakeProgress.val),
              onComplete: () => {
                const displayUrl = data.web2url.replace(
                  "ipfs.crossbell.io",
                  "ipfs.tianhw.top",
                );
                showResult(displayUrl);
              },
            });
          } else {
            handleError("上传失败");
          }
        } else {
          handleError("服务器响应错误");
        }
      }
    };

    xhr.onerror = () => {
      // 如果直接上传失败且当前是 direct 模式，提示用户使用代理
      if (UPLOAD_CONFIG.mode === "direct") {
        handleError(
          '上传失败，可能是 CORS 跨域问题。请部署 Cloudflare Worker 代理并修改 UPLOAD_CONFIG.mode 为 "proxy"',
        );
      } else {
        handleError("网络错误");
      }
    };
    const uploadUrl =
      UPLOAD_CONFIG.mode === "proxy"
        ? UPLOAD_CONFIG.proxy
        : UPLOAD_CONFIG.direct;
    xhr.open("POST", uploadUrl, true);
    xhr.send(formData);
  }

  function handleError(msg) {
    alert(msg);
    resetUI();
  }

  function updateProgress(percent) {
    const p = Math.min(percent, 100);
    progressBar.style.width = `${p}%`;
    progressText.innerText = `${Math.round(p)}%`;
  }

  function showResult(url) {
    setTimeout(() => {
      const tl = gsap.timeline({
        defaults: { duration: 0.6, ease: "expo.inOut" },
      });
      tl.to(progressContainer, {
        autoAlpha: 0,
        y: -60,
        scale: 0.95,
        onComplete: () => {
          progressContainer.classList.add("hidden");
          resultContainer.classList.remove("hidden");
          urlInput.value = url;
          mainTitle.innerText = "上传成功！";

          const loader = document.getElementById("image-loader");
          previewImage.src = url;
          previewImage.onload = () => {
            loader.style.display = "none";
            gsap.to(previewImage, {
              autoAlpha: 1,
              duration: 0.8,
              ease: "power2.out",
            });
          };
        },
      }).fromTo(
        resultContainer,
        { autoAlpha: 0, y: 60, scale: 1.05 },
        { autoAlpha: 1, y: 0, scale: 1 },
      );
    }, 400);
  }

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(urlInput.value).then(() => {
      const originalText = copyBtn.innerText;
      copyBtn.innerText = "已复制";
      copyBtn.classList.add("copy-success");

      setTimeout(() => {
        copyBtn.innerText = originalText;
        copyBtn.classList.remove("copy-success");
      }, 2000);
    });
  });

  resetBtn.addEventListener("click", resetUI);

  function resetUI() {
    const tl = gsap.timeline({
      defaults: { duration: 0.6, ease: "expo.inOut" },
    });
    tl.to([resultContainer, progressContainer], {
      autoAlpha: 0,
      y: 60,
      scale: 1.05,
      stagger: 0.1,
      onComplete: () => {
        resultContainer.classList.add("hidden");
        progressContainer.classList.add("hidden");
        dropZone.classList.remove("hidden");
        mainTitle.innerText = "IPFS 图床";

        fileInput.value = "";
        progressBar.style.width = "0%";
        progressText.innerText = "0%";
        const loader = document.getElementById("image-loader");
        loader.style.display = "flex";
        previewImage.style.opacity = "0";
        previewImage.src = "";
      },
    }).fromTo(
      dropZone,
      { autoAlpha: 0, y: -60, scale: 0.95 },
      { autoAlpha: 1, y: 0, scale: 1 },
    );
  }
});
