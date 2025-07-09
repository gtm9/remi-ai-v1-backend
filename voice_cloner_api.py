# from gradio_client import Client

# client = Client("https://1b1d-146-70-217-121.ngrok-free.app/")
# result = client.predict(
# 		text="Hello!!",
# 		max_tokens_per_sentence=120,
# 		api_name="/on_input_text_change"
# )
# print(result)

# from gradio_client import Client

# client = Client("https://1b1d-146-70-217-121.ngrok-free.app/")
# result = client.predict(
# 		api_name="/update_prompt_audio"
# )
# print(result)

from gradio_client import Client, handle_file

client = Client("https://a65746cba64da85b13.gradio.live/")
result = client.predict(
		# prompt=handle_file('/Users/goutamchapalamadugu/Desktop/projects/Python_Services/sarahPaine.mp3'),
		handle_file('https://github.com/gradio-app/gradio/raw/main/test/test_files/audio_sample.wav'),
		text="It’s hard to believe that one small letter could cause so much trouble. It was a regular Saturday morning; the sun was shining. I made my way downstairs, thinking all was right with the world. Then I saw the letter under my front door",
		infer_mode="ordinary reasoning",
		max_text_tokens_per_sentence=120,
		sentences_bucket_max_size=4,
		param_5=True,
		param_6=0.8,
		param_7=30,
		param_8=1,
		param_9=0,
		param_10=3,
		param_11=10,
		param_12=600,
		api_name="/gen_single"
)

print(result)
