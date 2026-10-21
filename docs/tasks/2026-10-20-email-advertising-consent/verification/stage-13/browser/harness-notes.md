# Harness diagnostics

- Начальный getByLabel OTP был неоднозначен: region и input имеют одно название. Исправлен на textbox locator; это не product defect.
- InputOTP работает со слотами и selection; raw fill поверх старого кода не является корректной эмуляцией замены. Resend scenario ждёт enabled, очищает6 Backspace и вводит новый код клавиатурой; DOM value и request generation проверены.
- Label click был корректен, но повтор по прежним screen coordinates после PDn error мог промахнуться из-за изменения высоты/позиции dialog. Проверка теперь доказывает один настоящий label click и восстанавливает состояние через штатный checkbox action.
- Hidden Radix BubbleInput opacity0 не считается видимым interactive target. Close44 circle corner misses объяснены radius и подтверждены center-click cancel.
- Ранние section screenshots PDF могли захватывать sticky header/соседнюю страницу при viewport clipping. Финальные artifacts: actual painted canvas PNG, стабильные fonts/layout и отдельные viewer viewport captures; никаких product CSS fixes ради screenshot не добавлялось. Только QA style scroll-behavior:auto для стабильного scroll capture.
- Первая версия дополнительных probes не сохраняла общий console/network listener. На той же final2 сборке32 checks повторены с общим observer; errors0/unexpected0. Повтор не увеличивает unique checks92.
- Промежуточные discovery failures не маскируются под итоговый pass: before содержит product findings, runner-final2/telemetry и after — полный clearing.
