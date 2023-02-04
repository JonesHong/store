export const Singleton = (target: any) => {
    target.getInstance = function (args?: any) {
        if (!target.instance) {
            target.instance = new target(args);
        }
        return target.instance;
    }
}