import config from "../config/config.js";

export const transitions = new Map<string, RoomTransition>();

export function cleanupWorker() {
    setInterval(() => {
        const now = Date.now();

        for (const [userID, transition] of transitions) {
            const inactiveFor = now - transition.lastSeen;

            if (inactiveFor > 5 * config.core.transitionTTL) transitions.delete(userID);
        }
    }, config.core.transitionCleanupInterval);
}

type Candidate = {
    roomID: string | null;
    since: number | null;
    samples: number;
    rssi: number | null;
};

export class RoomTransition {
    candidate: Candidate;
    lastSeen: number;

    constructor() {
        this.lastSeen = Date.now();
        this.candidate = { roomID: null, since: null, samples: 0, rssi: null };
    }

    shouldTransitionTo(
        roomID: string,
        candidateRSSI: number,
        currRSSI: number,
        lastCurrentSeen: number
    ) {
        const now = Date.now();
        this.lastSeen = now;

        const stronger = candidateRSSI > currRSSI + config.core.hysteresis;

        const signalLost = now - lastCurrentSeen > config.core.lossThreshold;

        console.log(`[TRANSITION] stronger = ${stronger}`);
        console.log(`[TRANSITION] signalLost = ${signalLost}`);

        if (!stronger && !signalLost) {
            this.reset();
            return false;
        }

        const noCandidate = this.candidate.roomID == null;
        const betterCandidate =
            this.candidate.roomID != roomID &&
            this.candidate.rssi !== null &&
            candidateRSSI > this.candidate.rssi + config.core.candidateHysteresis;

        console.log(`[TRANSITION] noCandidate = ${noCandidate}`);
        console.log(`[TRANSITION] betterCandidate = ${betterCandidate}`);

        if (noCandidate || betterCandidate) {
            this.candidate.roomID = roomID;
            this.candidate.since = now;
            this.candidate.samples = 1;
            this.candidate.rssi = candidateRSSI;

            return false;
        }

        this.candidate.samples++;
        this.candidate.rssi = candidateRSSI;

        console.log(`[TRANSITION] samples = ${this.candidate.samples}`);
        console.log(`[TRANSITION] candidateRSSI = ${this.candidate.rssi}`);

        const enoughTime = now - (this.candidate.since ?? now) >= config.core.debounceMS;
        const enoughConfirmations = this.candidate.samples >= config.core.minSamples;

        console.log(`[TRANSITION] enoughTime = ${enoughTime}`);
        console.log(`[TRANSITION] enoughConfirmations = ${enoughConfirmations}`);
        console.log(`[TRANSITION] signalLost = ${signalLost}`);

        if ((enoughTime && enoughConfirmations) || signalLost) {
            this.reset();
            return true;
        }

        return false;
    }

    reset() {
        this.candidate.roomID = null;
        this.candidate.since = null;
        this.candidate.samples = 0;
        this.candidate.rssi = null;
    }
}
