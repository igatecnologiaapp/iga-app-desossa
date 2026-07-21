
alter type public.app_role add value if not exists 'supervisor';
alter type public.app_role add value if not exists 'visualizacao';
alter type public.order_status add value if not exists 'atribuida';
alter type public.order_status add value if not exists 'aguardando_conferencia';
alter type public.order_status add value if not exists 'cancelada';
