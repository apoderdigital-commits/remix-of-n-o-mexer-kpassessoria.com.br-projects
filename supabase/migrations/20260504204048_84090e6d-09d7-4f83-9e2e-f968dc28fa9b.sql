
-- Add justification column for missed monthly meetings
ALTER TABLE public.squad_agenda
  ADD COLUMN IF NOT EXISTS not_done_reason text;

-- Seed April/2026 data for Squad Head Will
DO $$
DECLARE
  sid uuid;
  ref date := DATE '2026-04-01';
BEGIN
  SELECT id INTO sid FROM public.squads WHERE name ILIKE '%Head Will%' LIMIT 1;
  IF sid IS NULL THEN RETURN; END IF;

  -- Wipe any prior April 2026 seeded rows for this squad
  DELETE FROM public.squad_engagement WHERE squad_id = sid AND reference_month = ref;
  DELETE FROM public.squad_agenda WHERE squad_id = sid AND reference_month = ref;

  -- ===== ENGAJAMENTO ABRIL 2026 =====
  INSERT INTO public.squad_engagement
    (squad_id, reference_month, client_name, curve_abc, sprint, engagement_score, nps_individual, observation)
  VALUES
    (sid, ref, 'King Veículos','A','A',4,8,'Não deixa muito tempo sem responder'),
    (sid, ref, 'VR Multimarcas/ Shineray','A','A',5,9,'Um pouco mais de resultado'),
    (sid, ref, 'AVELLOZ PRAZERES','B','A',3,NULL,'Não respondeu'),
    (sid, ref, 'MOTO FÁCIL NATASHA','B','A',1,NULL,'Não respondeu'),
    (sid, ref, 'CGR','B','A',5,NULL,NULL),
    (sid, ref, 'Shineray Porto Velho D','B','A',5,NULL,NULL),
    (sid, ref, 'Shineray Ariquemes F','B','A',5,NULL,NULL),
    (sid, ref, 'SHINERAY CACOAL D','B','A',5,NULL,NULL),
    (sid, ref, 'Shineray Cuiabá D','B','A',5,NULL,NULL),
    (sid, ref, 'Shineray Vilhena','B','A',4,NULL,NULL),
    (sid, ref, 'Shineray Dourados','B','A',5,NULL,NULL),
    (sid, ref, 'SHINERAY JI PARANÁ','B','A',5,NULL,NULL),
    (sid, ref, 'Shineray Casa Forte','B','A',5,NULL,NULL),
    (sid, ref, 'Shineray Atibaia','B','A',3,10,'Até o momento estamos satisfeitos'),
    (sid, ref, 'P.BLACKI','B','A',5,10,'Agilidade e praticidade'),
    (sid, ref, 'Shineray Amazonas','B','A',5,NULL,NULL),
    (sid, ref, 'Angra dos Reis','B','B',4,10,'Por mim já tá 10'),
    (sid, ref, 'Avelloz Floriano','B','B',5,NULL,NULL),
    (sid, ref, 'Shineray Caxangá','B','B',5,NULL,NULL),
    (sid, ref, 'Shineray Prime','B','C',4,NULL,NULL),
    (sid, ref, 'Avelloz Goiania','C','A',4,NULL,NULL),
    (sid, ref, 'Moto Mil Ariquemes | Porto | Vilhena','C','A',2,NULL,NULL),
    (sid, ref, 'Bormam Jewelry','C','A',3,NULL,NULL),
    (sid, ref, 'Lider','C','A',4,NULL,NULL),
    (sid, ref, 'Guimarães','C','B',4,NULL,NULL),
    (sid, ref, 'Ravo Consult','C','B',5,NULL,NULL),
    (sid, ref, 'Donni Project','C','B',4,NULL,NULL),
    (sid, ref, 'Shineray MotoNow','C','C',1,NULL,'Não respondeu'),
    (sid, ref, 'Saad motos','C','C',3,10,'Sempre manter-se atualizados'),
    (sid, ref, 'Rafael Motos - Multimarcas','C','C',5,NULL,NULL),
    (sid, ref, 'Shineray Espirito Santo','C','C',1,NULL,'Sem serviço'),
    (sid, ref, 'Braba Motors','C','C',NULL,NULL,'Sem serviço'),
    (sid, ref, 'OXI-BRUNO','C','C',5,10,'Da dinâmica, conhecimento'),
    (sid, ref, 'CMG MOTOS','C','C',NULL,NULL,'Sem serviço'),
    (sid, ref, 'Meu AD','C','C',NULL,NULL,'Sem serviço'),
    (sid, ref, 'Paraiba Motos','C','C',NULL,NULL,'Sem serviço');

  -- ===== AGENDA (CONSULTORIA MENSAL) ABRIL 2026 =====
  INSERT INTO public.squad_agenda
    (squad_id, reference_month, category, client_name, responsible, meeting_date, meeting_time, done, not_done_reason)
  VALUES
    (sid, ref, 'A','Lider','WILL',DATE '2026-05-11','11:00',false,NULL),
    (sid, ref, 'A','Guimarães','WILL',DATE '2026-05-11','15:00',false,NULL),
    (sid, ref, 'A','Shineray Duas Rodas','WILL',DATE '2026-04-22','13:00',false,'Não realizada'),
    (sid, ref, 'A','OXI-BRUNO','WILL',NULL,NULL,false,'Próximo mês'),
    (sid, ref, 'A','VR Multimarcas/ Shineray','WILL',DATE '2026-04-24','13:00',true,NULL),
    (sid, ref, 'A','CMG MOTOS','WILL',NULL,NULL,false,'Próximo mês'),
    (sid, ref, 'A','MOTO FÁCIL NATASHA','WILL',DATE '2026-04-29','13:00',false,'Não realizada'),
    (sid, ref, 'A','Shineray Prime','WILL',DATE '2026-05-20','13:00',true,NULL),
    (sid, ref, 'A','King Veículos','WILL',DATE '2026-05-25','13:00',true,NULL),
    (sid, ref, 'A','Braba Motors','WILL',NULL,NULL,false,'Próximo mês'),
    (sid, ref, 'A','Ravo Consult','WILL',DATE '2026-05-06','13:00',false,NULL),
    (sid, ref, 'A','Shineray Casa Forte','WILL',DATE '2026-04-27','15:00',true,NULL),
    (sid, ref, 'A','Rafael Motos - Multimarcas','WILL',DATE '2026-05-04','11:00',true,NULL),
    (sid, ref, 'B','Angra dos Reis','WILL',DATE '2026-04-30','13:00',true,NULL),
    (sid, ref, 'B','CGR','WILL',DATE '2026-04-30','17:00',true,NULL),
    (sid, ref, 'B','Shineray Porto Velho D','WILL',DATE '2026-05-08','15:00',false,NULL),
    (sid, ref, 'B','Shineray Ariquemes F','WILL',DATE '2026-05-07','13:00',false,NULL),
    (sid, ref, 'B','SHINERAY CACOAL D','WILL',DATE '2026-05-12','11:00',false,NULL),
    (sid, ref, 'B','Shineray Cuiabá D','WILL',DATE '2026-05-13','13:00',false,NULL),
    (sid, ref, 'C','Shineray Dourados','WILL',DATE '2026-05-29','15:00',false,NULL),
    (sid, ref, 'A','SHINERAY JI PARANÁ','WILL',DATE '2026-05-06','11:00',false,NULL),
    (sid, ref, 'A','Shineray Atibaia','WILL',DATE '2026-05-06','15:00',false,NULL),
    (sid, ref, 'A','Avelloz Floriano','WILL',DATE '2026-04-28','11:00',true,NULL),
    (sid, ref, 'A','Shineray Caxangá','WILL',DATE '2026-05-07','16:00',false,NULL),
    (sid, ref, 'A','P.BLACKI','WILL',DATE '2026-04-23','11:00',true,NULL),
    (sid, ref, 'C','Avelloz Goiania','WILL',DATE '2026-05-04','13:00',true,NULL),
    (sid, ref, 'C','AVELLOZ PRAZERES','WILL',DATE '2026-05-05','11:00',false,NULL),
    (sid, ref, 'C','Bormam Jewelry','WILL',DATE '2026-05-05','15:00',false,NULL),
    (sid, ref, 'C','Donni Project','WILL',DATE '2026-05-01','15:00',false,NULL),
    (sid, ref, 'C','Shineray Amazonas','WILL',DATE '2026-04-28','15:00',true,NULL),
    (sid, ref, 'C','Moto Mil Ariquemes | Porto | Vilhena','WILL',DATE '2026-04-22','15:00',false,NULL),
    (sid, ref, 'A','Shineray MotoNow','WILL',DATE '2026-04-23','15:00',true,NULL),
    (sid, ref, 'A','Meu AD','WILL',NULL,NULL,false,'Próximo mês'),
    (sid, ref, 'A','Paraiba Motos','WILL',NULL,NULL,false,'Próximo mês'),
    (sid, ref, 'A','Saad motos','WILL',DATE '2026-05-07','15:00',false,NULL);
END $$;
