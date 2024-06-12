import { derived, get, writable } from 'svelte/store';
import { reiverrApi, type ReiverrUser } from '../apis/reiverr/reiverr-api';
import axios from 'axios';
import type { operations } from '../apis/reiverr/reiverr.generated';
import { type Session, sessions } from './session.store';

function useUser() {
	const activeSession = derived(sessions, (sessions) => sessions.activeSession);

	const userStore = writable<ReiverrUser | undefined | null>(undefined);

	let lastActiveSession: Session | undefined;
	activeSession.subscribe(async (activeSession) => {
		if (!activeSession) {
			userStore.set(null);
			return;
		}

		userStore.set(undefined);
		lastActiveSession = activeSession;
		const user = await axios
			.get<
				operations['UserController_getProfile']['responses']['200']['content']['application/json']
			>(activeSession.baseUrl + '/api/user', {
				headers: {
					Authorization: 'Bearer ' + activeSession.token
				}
			})
			.then((r) => r.data);

		if (lastActiveSession === activeSession) userStore.set(user);
	});

	async function updateUser(updateFn: (user: ReiverrUser) => ReiverrUser) {
		const user = get(userStore);

		if (!user) return;

		const updated = updateFn(user);
		const update = await reiverrApi.updateUser(updated);

		if (update) {
			userStore.set(update);
		}
	}

	return {
		subscribe: userStore.subscribe,
		updateUser
	};
}

export const user = useUser();
