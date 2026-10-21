import { useAuth, withAuth } from "../src/features/auth";

/** Compile-only checks of the public module contract; never imported by app routes. */
export function useAuthContractTypecheck() {
  const plain = useAuth();
  void plain.onAuth();
  // @ts-expect-error A no-payload trigger cannot receive an unrelated object.
  void plain.onAuth({ itemId: "one" });
  const typed = useAuth<{ itemId: string }>({
    onSuccess: (user, payload) => {
      const id: string = user.id;
      const itemId: string = payload.itemId;
      void id;
      void itemId;
    },
  });
  void typed.onAuth({ itemId: "one" });
  // @ts-expect-error A typed trigger requires the captured payload.
  void typed.onAuth();
  // @ts-expect-error The captured value must match the requested payload shape.
  void typed.onAuth({ itemId: 1 });
}

function PropsContract({ itemId }: { itemId: string }) {
  return <span>{itemId}</span>;
}
const Wrapped = withAuth(PropsContract, (props) => ({ source: props.itemId }));
export const authModulePropsContract = [
  <Wrapped key="valid" itemId="one" />,
  // @ts-expect-error The HOC preserves required component props.
  <Wrapped key="missing" />,
  // @ts-expect-error The HOC preserves the original component's prop types.
  <Wrapped key="invalid" itemId={1} />,
];
// @ts-expect-error Permission bypasses are not part of module configuration.
withAuth(PropsContract, { requireAdvertising: true });
// @ts-expect-error Unknown purposes cannot silently weaken server readiness checks.
withAuth(PropsContract, { purpose: "unknown" });
