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

  // 上传配置 - 支持多个 IPFS 服务商
  const UPLOAD_CONFIG = {
    // 当前使用的服务商，可选: 'crossbell', 'img2ipfs', 'pinata', 'web3storage', 'proxy'
    provider: "img2ipfs",

    // 各服务商配置
    providers: {
      // Crossbell - 原服务商（可能有 CORS 问题）
      crossbell: {
        url: "https://ipfs-relay.crossbell.io/upload",
        responseHandler: (data) => ({
          status: data.status === "ok" ? "ok" : "error",
          url: data.web2url?.replace("ipfs.crossbell.io", "ipfs.tianhw.top"),
          hash: data.ipfs_hash,
        }),
      },

      // Img2IPFS - 免费，无需注册，推荐
      // 接口文档: https://api.aa1.cn/doc/ipfs_fileupload.html
      img2ipfs: {
        url: "https://api.img2ipfs.org/api/v0/add?pin=false",
        responseHandler: (data) => ({
          status: "ok",
          url: `https://ipfs.io/ipfs/${data.Hash}`,
          hash: data.Hash,
        }),
      },

      // Pinata - 稳定可靠，需要 API Key
      // 注册: https://pinata.cloud
      pinata: {
        url: "https://api.pinata.cloud/pinning/pinFileToIPFS",
        headers: {
          // 需要替换为你的 Pinata JWT
          Authorization: "Bearer YOUR_PINATA_JWT",
        },
        responseHandler: (data) => ({
          status: data.IpfsHash ? "ok" : "error",
          url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
          hash: data.IpfsHash,
        }),
      },

      // Web3.Storage / Storacha - 5GB 免费
      // 注册: https://storacha.network/
      web3storage: {
        url: "https://api.web3.storage/upload",
        headers: {
          // 需要替换为你的 API Token
          Authorization: "Bearer YOUR_WEB3STORAGE_TOKEN",
        },
        responseHandler: (data) => ({
          status: data.cid ? "ok" : "error",
          url: `https://w3s.link/ipfs/${data.cid}`,
          hash: data.cid,
        }),
      },
    },

    // 代理配置（用于解决 CORS 问题）
    proxy: {
      url: "https://your-worker.your-subdomain.workers.dev",
      target: "crossbell", // 代理目标
    },
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
          try {
            const data = JSON.parse(xhr.responseText);
            const provider = UPLOAD_CONFIG.providers[UPLOAD_CONFIG.provider];
            const result = provider.responseHandler(data);

            if (result.status === "ok") {
              progressTween.kill();
              gsap.to(fakeProgress, {
                val: 100,
                duration: 0.4,
                onUpdate: () => updateProgress(fakeProgress.val),
                onComplete: () => {
                  showResult(result.url);
                },
              });
            } else {
              handleError("上传失败: " + (data.message || "未知错误"));
            }
          } catch (e) {
            handleError("解析响应失败: " + e.message);
          }
        } else {
          handleError("服务器响应错误: " + xhr.status);
        }
      }
    };

    xhr.onerror = () => {
      const currentProvider = UPLOAD_CONFIG.provider;
      handleError(
        `上传失败，可能是 CORS 跨域问题。当前使用: ${currentProvider}。请尝试切换其他服务商或部署代理。`,
      );
    };

    // 获取上传 URL 和请求头
    let uploadUrl;
    let headers = {};

    if (UPLOAD_CONFIG.provider === "proxy") {
      uploadUrl = UPLOAD_CONFIG.proxy.url;
    } else {
      const provider = UPLOAD_CONFIG.providers[UPLOAD_CONFIG.provider];
      uploadUrl = provider.url;
      if (provider.headers) {
        headers = provider.headers;
      }
    }

    xhr.open("POST", uploadUrl, true);

    // 设置请求头
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

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
