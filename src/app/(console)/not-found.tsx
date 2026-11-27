import { ErrorScenePage } from '@skylab-kulubu/skylcn-ui';

/** A missing page inside the console: the 404 scene, as a block in the shell (its title is the page's h1). */
export default function NotFound() {
  return <ErrorScenePage kind="notFound" href="/" as="div" />;
}
