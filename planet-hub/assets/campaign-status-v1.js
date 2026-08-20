(() => {
  const campaignYear = 2026;
  const months = {
    JAN: 0,
    FEV: 1,
    MAR: 2,
    ABR: 3,
    MAI: 4,
    JUN: 5,
    JUL: 6,
    AGO: 7,
    SET: 8,
    OUT: 9,
    NOV: 10,
    DEZ: 11,
  };

  function campaignEndDate(article, monthIndex) {
    const details = article.querySelector(":scope > div:nth-child(2) p");
    const text = details?.textContent?.toUpperCase() || "";
    const dayMatches = [...text.matchAll(/\b([0-3]?\d)\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b/g)];

    if (dayMatches.length) {
      const lastMatch = dayMatches[dayMatches.length - 1];
      return new Date(campaignYear, months[lastMatch[2]], Number(lastMatch[1]), 23, 59, 59, 999);
    }

    const rangeDays = text.match(/\b([0-3]?\d)\s*[—–-]\s*([0-3]?\d)\b/);
    if (rangeDays) {
      return new Date(campaignYear, monthIndex, Number(rangeDays[2]), 23, 59, 59, 999);
    }

    return new Date(campaignYear, monthIndex + 1, 0, 23, 59, 59, 999);
  }

  function updatePastCampaigns() {
    const now = new Date();

    document.querySelectorAll("#root article").forEach((article) => {
      const monthLabel = article.querySelector(":scope > div:first-child > strong")?.textContent?.trim().toUpperCase();
      if (!(monthLabel in months)) return;

      const isPast = now > campaignEndDate(article, months[monthLabel]);
      article.classList.toggle("campaign-is-past", isPast);
      article.toggleAttribute("data-campaign-past", isPast);
    });
  }

  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updatePastCampaigns();
    });
  };

  const start = () => {
    updatePastCampaigns();
    new MutationObserver(scheduleUpdate).observe(document.getElementById("root"), {
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
