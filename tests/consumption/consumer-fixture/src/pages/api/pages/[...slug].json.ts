import { agentPageRoute } from '@commondocs-kitty/toolkit/routes';

const route = agentPageRoute();
export const getStaticPaths = route.getStaticPaths;
export const GET = route.GET;
