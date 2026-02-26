document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const form = document.getElementById('creation-form');
    const loadingState = document.getElementById('loading-state');
    const resultView = document.getElementById('result-view');

    // Form Inputs
    const recipientInput = document.getElementById('recipient-name');
    const occasionInput = document.getElementById('occasion');
    const melodySelect = document.getElementById('melody');
    const dictationInput = document.getElementById('dictation');
    const dictationLabel = document.getElementById('dictation-label');
    const dictationHelper = document.getElementById('dictation-helper');
    const modeRadios = document.querySelectorAll('input[name="generation-mode"]');

    // Mic Elements
    const micBtn = document.getElementById('mic-btn');
    const micStatus = document.getElementById('mic-status');

    // Result Elements
    const resName = document.getElementById('res-name');
    const resOccasion = document.getElementById('res-occasion');
    const songLyrics = document.getElementById('song-lyrics');
    const playingMelodyName = document.getElementById('playing-melody-name');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = playPauseBtn.querySelector('i');
    const createNewBtn = document.getElementById('create-new-btn');

    // Action Buttons
    const shareBtn = document.getElementById('share-btn');
    const copyTextBtn = document.getElementById('copy-text-btn');
    const cardToDownload = document.getElementById('card-to-download');
    const voiceBtn = document.getElementById('voice-btn');
    const voiceSelect = document.getElementById('voice-select');

    // Social Panel
    const socialPanel = document.getElementById('social-panel');
    const shareTg = document.getElementById('share-tg');
    const shareWa = document.getElementById('share-wa');
    const shareVb = document.getElementById('share-vb');
    const shareCopy = document.getElementById('share-copy');

    // Audio Player
    const bgAudio = document.getElementById('bg-audio');
    const voiceAudio = document.getElementById('voice-audio');
    const visualizer = document.getElementById('visualizer');
    const canvasCtx = visualizer.getContext('2d');

    // --- State ---
    let isRecording = false;
    let recognition = null;
    let isPlaying = false;
    let currentAudioUrl = '';
    let currentCardId = null; // Store the ID if this card was loaded or already saved

    // --- Audio Context and Visualizer ---
    let audioCtx;
    let analyser;
    let source;
    let dataArray;
    let bufferLength;
    let visualizerAnimationId;

    // --- Audio Helpers ---
    const fadeAudio = (audioElement, targetVolume, duration) => {
        const step = 50; // ms
        const volumeStep = (targetVolume - audioElement.volume) / (duration / step);
        const interval = setInterval(() => {
            let newVolume = audioElement.volume + volumeStep;
            if ((volumeStep > 0 && newVolume >= targetVolume) || (volumeStep < 0 && newVolume <= targetVolume)) {
                audioElement.volume = targetVolume;
                clearInterval(interval);
            } else {
                audioElement.volume = newVolume;
            }
        }, step);
    };

    const initAudioContext = () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();

            // CORS settings for background audio
            bgAudio.crossOrigin = "anonymous";
            voiceAudio.crossOrigin = "anonymous";

            source = audioCtx.createMediaElementSource(bgAudio);
            const voiceSource = audioCtx.createMediaElementSource(voiceAudio);

            source.connect(analyser);
            voiceSource.connect(analyser);
            analyser.connect(audioCtx.destination);

            analyser.fftSize = 64;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        }
    };

    const drawVisualizer = () => {
        visualizerAnimationId = requestAnimationFrame(drawVisualizer);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, visualizer.width, visualizer.height);

        const barWidth = (visualizer.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 255 * visualizer.height;
            canvasCtx.fillStyle = `rgb(139, 92, 246)`; // primary color
            canvasCtx.fillRect(x, visualizer.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    };

    // --- Web Speech API Setup ---
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ru-RU'; // Set to Russian

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
            micStatus.classList.remove('hidden');
            micStatus.textContent = 'Слушаю... (Нажмите еще раз, чтобы остановить)';
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Append final and show interim
            if (finalTranscript) {
                const currentVal = dictationInput.value;
                const prefix = currentVal && !currentVal.endsWith(' ') ? currentVal + ' ' : currentVal;
                dictationInput.value = prefix + finalTranscript;
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'not-allowed') {
                micStatus.textContent = 'Доступ к микрофону заблокирован браузером. Пожалуйста, введите текст вручную.';
            } else {
                micStatus.textContent = `Ошибка микрофона (${event.error}).`;
            }
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
        };
    } else {
        micBtn.style.display = 'none';
        micStatus.classList.remove('hidden');
        micStatus.textContent = 'Голосовой ввод не поддерживается вашим браузером.';
    }

    // --- Mode Toggle Logic ---
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isManual = e.target.value === 'manual';
            if (isManual) {
                dictationLabel.innerHTML = 'Ваш готовый текст';
                dictationHelper.textContent = 'Напишите или вставьте готовый стих. ИИ просто красиво его прочитает.';
                dictationInput.placeholder = 'Вставьте ваш текст...';
                micBtn.style.display = 'none';
                if (isRecording) stopRecording();
            } else {
                dictationLabel.innerHTML = 'Что пожелать? <span id="mic-badge" class="badge">Голосовой ввод</span>';
                dictationHelper.textContent = 'Надиктуйте суть поздравления, а ИИ превратит это в красивую песню.';
                dictationInput.placeholder = 'Скажите что-нибудь теплое...';
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    micBtn.style.display = 'flex';
                }
            }
        });
    });

    const startRecording = () => {
        if (recognition) {
            try {
                recognition.start();
            } catch (e) {
                console.warn(e);
            }
        }
    };

    const stopRecording = () => {
        if (recognition && isRecording) {
            recognition.stop();
        }
        isRecording = false;
        micBtn.classList.remove('recording');
        micStatus.classList.add('hidden');
    };

    micBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // --- Real AI Generation (Backend API) ---
    const generateSongVerse = async (name, occasion, prompt, mood) => {
        try {
            const response = await fetch('https://music-card-backend.onrender.com/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, occasion, prompt, mood })
            });

            if (!response.ok) {
                throw new Error('Ой, что-то пошло не так на сервере.');
            }

            const data = await response.json();
            return data.lyrics;
        } catch (error) {
            console.error('Error fetching lyrics:', error);
            alert('Не удалось связаться с сервером ИИ. Серверу может потребоваться до 50 секунд для выхода из спящего режима на бесплатном тарифе, подождите немного и попробуйте снова.');
            return 'К сожалению, не удалось связаться с ИИ. Пожалуйста, подождите немного, пока сервер запустится.';
        }
    };

    // --- Form Submission Logic ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Stop dictation just in case it's still running
        stopRecording();

        const name = recipientInput.value.trim();
        const occasion = occasionInput.value.trim();
        const melodyOption = melodySelect.options[melodySelect.selectedIndex];
        const audioUrl = melodyOption.getAttribute('data-url');
        const melodyText = melodyOption.text;
        const dictation = dictationInput.value.trim();

        if (!name || !occasion || !audioUrl || !dictation) return;

        // 1. Hide form, show loading
        form.classList.add('hidden');
        loadingState.classList.remove('hidden');

        // 2. Generate or use manual content
        const generationMode = document.querySelector('input[name="generation-mode"]:checked').value;
        const style = melodyOption.getAttribute('data-style') || melodySelect.options[melodySelect.selectedIndex].text;

        let generatedLyrics = '';
        if (generationMode === 'manual') {
            // Fake loading state slightly so it feels like it's processing
            await new Promise(r => setTimeout(r, 800));
            generatedLyrics = dictation;
        } else {
            generatedLyrics = await generateSongVerse(name, occasion, dictation, style);
        }

        currentAudioUrl = audioUrl;

        // 3. Prepare Audio (via proxy to bypass strict CORS for visualizer)
        bgAudio.src = `https://music-card-backend.onrender.com/api/audio-proxy?url=${encodeURIComponent(audioUrl)}`;
        bgAudio.load();

        // 4. Update UI
        resName.textContent = name;
        resOccasion.textContent = occasion;
        songLyrics.textContent = generatedLyrics;
        playingMelodyName.textContent = melodyText;

        // 5. Hide loading, show result
        loadingState.classList.add('hidden');
        resultView.classList.remove('hidden');

        // Clear current card ID for new generations
        currentCardId = null;

        // Play audio automatically if possible (browsers might block autoplay, so we handle the promise)
        initAudioContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        bgAudio.play().then(() => {
            isPlaying = true;
            playIcon.classList.replace('ph-play', 'ph-pause');
            drawVisualizer();
        }).catch((err) => {
            console.log('Autoplay prevented by browser', err);
            isPlaying = false;
            playIcon.classList.replace('ph-pause', 'ph-play');
        });
    });

    // --- Audio Player Controls ---
    const togglePlay = async (forcePlay = false) => {
        if (isPlaying && !forcePlay) {
            bgAudio.pause();
            playIcon.classList.replace('ph-pause', 'ph-play');
            playPauseBtn.classList.remove('pulse-glow');
            isPlaying = false;
            cancelAnimationFrame(visualizerAnimationId);
            canvasCtx.clearRect(0, 0, visualizer.width, visualizer.height);
        } else if (!isPlaying || forcePlay) {
            initAudioContext();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            try {
                // Ensure audio is loaded before playing
                if (bgAudio.readyState === 0) {
                    bgAudio.load();
                }

                await bgAudio.play();
                playIcon.classList.replace('ph-play', 'ph-pause');
                playPauseBtn.classList.add('pulse-glow');
                isPlaying = true;
                drawVisualizer();
            } catch (err) {
                console.error("Playback failed (invalid URL or blocked):", err);
                playIcon.classList.replace('ph-pause', 'ph-play');
                playPauseBtn.classList.remove('pulse-glow');
                isPlaying = false;
            }
        }
    };

    playPauseBtn.addEventListener('click', () => togglePlay());

    // --- Share & Download Logic ---
    shareBtn.addEventListener('click', () => {
        if (navigator.share && /mobile/i.test(navigator.userAgent)) {
            // Use native share on mobile if available
            try {
                navigator.share({
                    title: 'Музыкальная Открытка',
                    text: `Посмотри, какую песню-поздравление я создал для ${resName.textContent}!\n\n${songLyrics.innerText}`
                });
            } catch (err) {
                console.log('Share failed:', err);
            }
        } else {
            // Toggle custom social panel on desktop or if share fails
            socialPanel.classList.toggle('hidden');
        }
    });

    const getShareUrl = async () => {
        const data = {
            name: resName.textContent,
            occasion: resOccasion.textContent,
            lyrics: songLyrics.innerText,
            audioUrl: currentAudioUrl,
            melodyText: playingMelodyName.textContent
        };

        try {
            const jsonStr = JSON.stringify(data);
            const compressed = LZString.compressToEncodedURIComponent(jsonStr);
            let baseUrl = window.location.href.split('?')[0].split('#')[0];

            // Generate a clean URL even if the user is viewing via file:/// or localhost
            if (baseUrl.startsWith('file://') || baseUrl.includes('localhost')) {
                baseUrl = 'https://music-card-frontend.vercel.app/';
            }

            return `${baseUrl}?data=${compressed}`;
        } catch (error) {
            console.error("Failed to generate share link", error);
            alert("Не удалось создать ссылку для этой открытки.");
            return window.location.href; // Fallback
        }
    };

    const getShareText = async () => {
        const url = await getShareUrl();
        return encodeURIComponent(`Привет! Я создал для тебя музыкальную открытку с помощью искусственного интеллекта! 🎁\n\nОткрой эту ссылку, чтобы послушать:\n${url}`);
    };

    shareTg.addEventListener('click', async () => {
        const url = await getShareUrl();
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Привет! Посмотри эту музыкальную открытку 🎁')}`, '_blank');
    });

    shareWa.addEventListener('click', async () => {
        const text = await getShareText();
        window.open(`https://wa.me/?text=${text}`, '_blank');
    });

    shareVb.addEventListener('click', async () => {
        const text = await getShareText();
        window.open(`viber://forward?text=${text}`, '_self');
    });

    shareCopy.addEventListener('click', async () => {
        try {
            const text = await getShareText();
            await navigator.clipboard.writeText(decodeURIComponent(text));
            const orig = shareCopy.innerHTML;
            shareCopy.innerHTML = '<i class="ph-bold ph-check"></i> Скопировано';
            setTimeout(() => shareCopy.innerHTML = orig, 2000);
        } catch (err) {
            console.error('Failed to copy', err);
            alert('Не удалось скопировать текст');
        }
    });

    copyTextBtn.addEventListener('click', async () => {
        const textToCopy = songLyrics.innerText.trim();
        if (!textToCopy) return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalText = copyTextBtn.innerHTML;
            copyTextBtn.innerHTML = '<i class="ph-bold ph-check"></i> Скопировано!';
            setTimeout(() => {
                copyTextBtn.innerHTML = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
            alert('Не удалось скопировать текст. Попробуйте выделить его вручную.');
        }
    });

    // --- Reset Logic ---
    createNewBtn.addEventListener('click', () => {
        // Stop audio
        bgAudio.pause();
        bgAudio.currentTime = 0;
        voiceAudio.pause();
        voiceAudio.currentTime = 0;

        isPlaying = false;
        if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId);
        canvasCtx.clearRect(0, 0, visualizer.width, visualizer.height);

        // Reset Form values
        form.reset();
        socialPanel.classList.add('hidden');
        voiceBtn.innerHTML = '<i class="ph-bold ph-microphone-stage"></i> Озвучить ИИ';

        // Switch Views
        resultView.classList.add('hidden');
        form.classList.remove('hidden');
    });

    // --- Voice Synthesis Logic ---
    voiceBtn.addEventListener('click', async () => {
        const textToSpeech = songLyrics.innerText.trim();
        if (!textToSpeech) return;

        const originalText = voiceBtn.innerHTML;
        voiceBtn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Подготовка...';
        voiceBtn.disabled = true;

        try {
            const response = await fetch('https://music-card-backend.onrender.com/api/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: textToSpeech, voice: voiceSelect.value })
            });

            if (!response.ok) throw new Error('Ошибка синтеза речи');

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);

            voiceAudio.src = audioUrl;

            // Start audio context if suspended
            initAudioContext();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            await voiceAudio.play();

            // Mix with background music
            if (!isPlaying) {
                await togglePlay(true); // Directly call the play function instead of simulating a click
            }

            // Lower background music volume smoothly to let voice punch through (ducking)
            fadeAudio(bgAudio, 0.15, 500); // 15% volume over 500ms
            voiceAudio.volume = 1.0;

            voiceAudio.onended = () => {
                fadeAudio(bgAudio, 1.0, 1000); // fade back to 100% over 1 second
                voiceBtn.innerHTML = '<i class="ph-bold ph-microphone-stage"></i> Повторить голос';
                voiceBtn.disabled = false;
            };

        } catch (error) {
            console.error(error);
            alert('Не удалось сгенерировать голос. Проверьте сервер.');
            voiceBtn.innerHTML = originalText;
            voiceBtn.disabled = false;
        }
    });

    // --- On Load: Check if Card is Shared in URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');
    const cardDataStr = urlParams.get('data');

    const loadCardData = (data) => {
        resName.textContent = data.name;
        resOccasion.textContent = data.occasion;
        songLyrics.textContent = data.lyrics;
        playingMelodyName.textContent = data.melodyText;
        currentAudioUrl = data.audioUrl;

        bgAudio.src = `https://music-card-backend.onrender.com/api/audio-proxy?url=${encodeURIComponent(currentAudioUrl)}`;
        bgAudio.load();

        loadingState.classList.add('hidden');
        resultView.classList.remove('hidden');

        // Suggest playing the voice immediately to the receiver
        voiceBtn.classList.add('pulse-glow');
        voiceBtn.innerHTML = '<i class="ph-bold ph-play-circle"></i> Нажмите, чтобы послушать ИИ';
    };

    if (cardDataStr) {
        try {
            form.classList.add('hidden');
            loadingState.classList.remove('hidden');
            const jsonStr = LZString.decompressFromEncodedURIComponent(cardDataStr);
            const data = JSON.parse(jsonStr);
            loadCardData(data);
        } catch (e) {
            console.error('Failed to parse card data from URL param', e);
            loadingState.classList.add('hidden');
            form.classList.remove('hidden');
            alert("Открытка повреждена или ссылка устарела.");
        }
    } else if (cardId) {
        currentCardId = cardId;
        // Show loading state while fetching from old backend links
        form.classList.add('hidden');
        loadingState.classList.remove('hidden');

        fetch(`https://music-card-backend.onrender.com/api/cards/${cardId}`)
            .then(res => {
                if (!res.ok) throw new Error("Card not found");
                return res.json();
            })
            .then(data => loadCardData(data))
            .catch(e => {
                console.error('Failed to fetch card data from URL', e);
                loadingState.classList.add('hidden');
                form.classList.remove('hidden');
                alert("К сожалению, эта ссылка устарела или сервер был перезагружен.");
            });
    }
});
