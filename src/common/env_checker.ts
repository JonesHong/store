type EnvType = "nodejs" | "service_worker" | "browser";
let envType!: EnvType;
// https://www.geeksforgeeks.org/how-to-check-the-current-runtime-environment-is-a-browser-in-javascript/
function EnvChecker() {

    // Check if the environment is Node.js
    if (typeof process === "object" &&
        typeof require === "function") {
        envType = "nodejs";
    }

    // Check if the environment is a Service worker
    // if (typeof importScripts === "function") {
    //     envType = "service_worker";
    // }

    // Check if the environment is a Browser
    if (typeof window === "object") {
        envType = "browser";
    }
}
EnvChecker();

export { EnvType, envType }