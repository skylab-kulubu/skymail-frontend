import { redirect } from 'next/navigation';

// The breadcrumb links each segment of /mailing-lists/<segment>/<id>; the
// segment alone has no page of its own, so it leads back to the lists.
export default function Page() {
  redirect('/mailing-lists');
}
