import { models } from "./models";
export function getPreference(key: string, fallback: string) {
  try {
    return localStorage.getItem(`local-writer-${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
export function setPreference(key: string, value: string) {
  try {
    localStorage.setItem(`local-writer-${key}`, value);
    return true;
  } catch {
    return false;
  }
}
export function preferredModel() {
  const id = getPreference("model", models[0].id);
  return models.some((item) => item.id === id) ? id : models[0].id;
}
