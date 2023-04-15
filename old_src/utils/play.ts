import { execSync } from "child_process";

export function play(fname: string) {
    execSync(`play -q ${fname} -t alsa`);
}