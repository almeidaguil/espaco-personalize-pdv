export function hasActiveVercelProtectionBypass(protectionBypass) {
  if (protectionBypass == null) return false;
  if (
    typeof protectionBypass !== "object" ||
    Array.isArray(protectionBypass) ||
    Object.getPrototypeOf(protectionBypass) !== Object.prototype
  ) {
    return true;
  }

  const keys = Reflect.ownKeys(protectionBypass);
  if (keys.length === 0) return false;

  return !(
    keys.length === 1 &&
    keys[0] === "" &&
    protectionBypass[""] === null
  );
}
