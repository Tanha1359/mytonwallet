import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { selectCurrentAccount } from '../../global/selectors';
import { IS_IOS_APP } from '../../util/windowEnvironment';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import Content from './Content';

import styles from './ReceiveModal.module.scss';

type StateProps = {
  isOpen?: boolean;
  isLedger?: boolean;
  isTestnet?: boolean;
  isSwapDisabled: boolean;
  isOnRampDisabled: boolean;
};

function ReceiveModal({
  isOpen,
  isTestnet,
  isLedger,
  isSwapDisabled,
  isOnRampDisabled,
}: StateProps) {
  const { closeReceiveModal } = getActions();

  const lang = useLang();

  const { isLandscape } = useDeviceScreen();
  const isSwapAllowed = !isTestnet && !isLedger && !isSwapDisabled;
  const isOnRampAllowed = !isTestnet && !isOnRampDisabled;
  const modalTitle = lang(isSwapAllowed || isOnRampAllowed ? 'Add / Buy' : 'Add');

  useEffect(() => {
    if (isOpen && isLandscape) {
      closeReceiveModal();
    }
  }, [isLandscape, isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      dialogClassName={IS_IOS_APP ? undefined : styles.modalDialog}
      nativeBottomSheetKey="receive"
      onClose={closeReceiveModal}
    >
      <ModalHeader title={modalTitle} className={styles.receiveHeader} onClose={closeReceiveModal} />
      <Content
        isOpen={isOpen}
        onClose={closeReceiveModal}
      />
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { isSwapDisabled, isOnRampDisabled } = global.restrictions;
  const account = selectCurrentAccount(global);

  return {
    isOpen: global.isReceiveModalOpen,
    isTestnet: global.settings.isTestnet,
    isSwapDisabled,
    isOnRampDisabled,
    isLedger: Boolean(account?.ledger),
  };
})(ReceiveModal));
