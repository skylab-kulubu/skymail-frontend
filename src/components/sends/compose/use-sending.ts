'use client';

// What happens once the sender confirms: a send to a list goes to its page,
// or says why it could not open — and when the answer leaves it unknown
// whether the send opened, holds the same send back until a re-send is
// confirmed. People are sent to one by one, and their outcomes kept for the
// summary and for a confirmed retry of those who have not got the mail for
// sure. The rules are send.ts's; this is their state.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { asApiError } from '@/lib/api/errors';
import { useApi } from '@/lib/api/react';
import { flashNotice } from '@/lib/notice';
import { sendHref } from '@/lib/sends';
import {
  mergeOutcomes,
  sendFailure,
  sendToList,
  sendToPeople,
  whyNotFound,
  type ChosenList,
  type ListSendRequest,
  type PersonOutcome,
  type SendFailure,
  type SingleSendRequest,
  type UncertainListSend,
} from '@/lib/send-form/send';

export type Progress = Readonly<{ done: number; total: number }>;

/** How a send to people went, and what it sent. */
export type PeopleResult = Readonly<{ what: string; requests: readonly SingleSendRequest[]; outcomes: readonly PersonOutcome[] }>;

export function useSending({ canSeeSends }: { canSeeSends: boolean }) {
  const api = useApi();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  /** Why the last send to a list did not open, or may not have. */
  const [listFailure, setListFailure] = useState<SendFailure | null>(null);
  /** A send to a list that may be open: the same one waits for a confirmed re-send. */
  const [uncertain, setUncertain] = useState<UncertainListSend | null>(null);
  /** A list send that opened, for a sender who cannot open its page. */
  const [queued, setQueued] = useState<string | null>(null);
  const [people, setPeople] = useState<PeopleResult | null>(null);

  async function toList(request: ListSendRequest, list: ChosenList, what: string) {
    setProgress({ done: 0, total: 1 });
    setListFailure(null);
    try {
      const id = await sendToList(api, request);
      const text = `Gönderim kuyruğa alındı: ${what}, “${list.name}” listesine.`;
      setUncertain(null);
      if (canSeeSends) {
        flashNotice(sendHref(id), { tone: 'success', text });
        router.push(sendHref(id));
        return;
      }
      setQueued(text);
    } catch (error) {
      // A 404 is final either way; asking for the template and the list says which of them is gone.
      const failure: SendFailure =
        asApiError(error).status === 404
          ? { kind: 'final', reason: await whyNotFound(api, { templateId: request.template_id, list }) }
          : sendFailure(error, 'list', { canSeeSends });
      setListFailure(failure);
      // Only a send that opened lifts an earlier doubt; a refused re-send leaves it where it was.
      if (failure.kind === 'uncertain') setUncertain({ templateId: request.template_id, listId: list.id, listName: list.name });
    }
    setProgress(null);
  }

  async function toPeople(requests: readonly SingleSendRequest[], what: string) {
    setProgress({ done: 0, total: requests.length });
    const outcomes = await sendToPeople(api, requests, {
      canSeeSends,
      onEach: (done) => setProgress({ done, total: requests.length }),
    });
    setProgress(null);
    setPeople({ what, requests, outcomes });
  }

  /** Sends again to some of the people sent to; the sender has confirmed who. */
  async function retryPeople(requests: readonly SingleSendRequest[]) {
    if (!people) return;
    setProgress({ done: 0, total: requests.length });
    const again = await sendToPeople(api, requests, {
      canSeeSends,
      onEach: (done) => setProgress({ done, total: requests.length }),
    });
    setProgress(null);
    setPeople({ ...people, outcomes: mergeOutcomes(people.outcomes, again) });
  }

  function reset() {
    setPeople(null);
    setQueued(null);
    setListFailure(null);
    setUncertain(null);
  }

  return { progress, listFailure, uncertain, queued, people, toList, toPeople, retryPeople, reset };
}
