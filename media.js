const Skip90Media = (() => {
  function getForwardTarget(currentTime, duration, seekableRanges, skipSeconds) {
    if (!Number.isFinite(currentTime) || currentTime < 0 || !(duration > 0) ||
        !Skip90Config.isValidDuration(skipSeconds)) {
      return null;
    }

    const limit = Math.min(currentTime + skipSeconds, duration);
    let target = currentTime;
    for (const [start, end] of seekableRanges) {
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end) continue;
      const reachable = Math.min(limit, end);
      if (reachable >= start && reachable > target) target = reachable;
    }
    return target > currentTime ? target : null;
  }

  return Object.freeze({ getForwardTarget });
})();
