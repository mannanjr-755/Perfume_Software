import Swal from 'sweetalert2';

export const toast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 2000,
  timerProgressBar: true,
  didOpen: (element) => {
    element.addEventListener('mouseenter', Swal.stopTimer);
    element.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export function toastSuccess(title, text = '') {
  return toast.fire({ icon: 'success', title, text });
}

export function toastError(title, text = '') {
  return toast.fire({ icon: 'error', title, text });
}

export function toastWarning(title, text = '') {
  return toast.fire({ icon: 'warning', title, text });
}
