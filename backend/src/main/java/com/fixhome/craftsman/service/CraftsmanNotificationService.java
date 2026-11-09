package com.fixhome.craftsman.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixhome.domain.user.User;
import com.fixhome.craftsman.repository.CraftsmanProfileRepository;
import com.fixhome.offer.entity.Offer;
import com.fixhome.offer.service.OfferNotifier;
import com.fixhome.request.entity.ServiceRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class CraftsmanNotificationService implements CraftsmanNotifier, OfferNotifier {

    private static final Logger logger = LoggerFactory.getLogger(CraftsmanNotificationService.class);
    private static final String EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
    private static final int EXPO_BATCH_SIZE = 100;

    private final CraftsmanProfileRepository craftsmanProfileRepository;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public CraftsmanNotificationService(
            CraftsmanProfileRepository craftsmanProfileRepository,
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper) {
        this.craftsmanProfileRepository = craftsmanProfileRepository;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = restClientBuilder.clone().requestFactory(requestFactory).build();
        this.objectMapper = objectMapper;
    }

    @Override
    public void notifyMatchingCraftsmen(ServiceRequest request) {
        String city = request.getCustomer().getCity();
        if (city == null || city.isBlank()) {
            return;
        }

        List<String> pushTokens = craftsmanProfileRepository.findPushTokensForRequest(
                city,
                request.getCategory().getId());
        for (int start = 0; start < pushTokens.size(); start += EXPO_BATCH_SIZE) {
            sendBatch(request, pushTokens.subList(start, Math.min(start + EXPO_BATCH_SIZE, pushTokens.size())));
        }
    }

    @Override
    public void notifyCustomerOfOffer(ServiceRequest request, Offer offer) {
        User customer = request.getCustomer();
        String pushToken = customer.getExpoPushToken();
        if (pushToken == null || pushToken.isBlank()) {
            return;
        }

        String craftsmanName = offer.getCraftsman().getCompanyName();
        String body = (craftsmanName == null || craftsmanName.isBlank())
                ? "Majstor je konkurisao za vaš posao."
                : craftsmanName + " je konkurisao za vaš posao.";
        Map<String, Object> message = Map.of(
                "to", pushToken,
                "title", "Primili ste novu ponudu",
                "body", body,
                "sound", "default",
                "channelId", "default",
                "data", Map.of(
                        "type", "OFFER_RECEIVED",
                        "requestId", request.getId(),
                        "offerId", offer.getId()));
        sendOfferNotification(request.getId(), message);
    }

    @Override
    public void notifyCraftsmanOfferAccepted(ServiceRequest request, Offer offer) {
        String pushToken = offer.getCraftsman().getExpoPushToken();
        if (pushToken == null || pushToken.isBlank()) {
            return;
        }
        Map<String, Object> message = Map.of(
                "to", pushToken,
                "title", "Ponuda je prihvaćena",
                "body", "Korisnik je prihvatio vašu ponudu. Kontakt podaci su dostupni u zahtevu.",
                "sound", "default",
                "channelId", "default",
                "data", Map.of(
                        "type", "OFFER_ACCEPTED",
                        "requestId", request.getId(),
                        "offerId", offer.getId()));
        sendOfferNotification(request.getId(), message);
    }

    private void sendOfferNotification(Long requestId, Map<String, Object> message) {
        try {
            String response = restClient.post()
                    .uri(EXPO_PUSH_ENDPOINT)
                    .body(List.of(message))
                    .retrieve()
                    .body(String.class);
            logRejectedTickets(response);
        } catch (RestClientException exception) {
            logger.warn("Could not send new-offer push notification for request {}", requestId, exception);
        }
    }

    private void sendBatch(ServiceRequest request, List<String> pushTokens) {
        List<Map<String, Object>> messages = pushTokens.stream()
                .map(token -> Map.<String, Object>of(
                        "to", token,
                        "title", "Novi posao u " + request.getCustomer().getCity(),
                        "body", "Novi zahtev za kategoriju " + request.getCategory().getName(),
                        "sound", "default",
                        "channelId", "default",
                        "data", Map.of("requestId", request.getId())))
                .toList();

        try {
            String response = restClient.post()
                    .uri(EXPO_PUSH_ENDPOINT)
                    .body(messages)
                    .retrieve()
                    .body(String.class);
            logRejectedTickets(response);
        } catch (RestClientException exception) {
            logger.warn("Could not send new-request push notifications for request {}", request.getId(), exception);
        }
    }

    private void logRejectedTickets(String response) {
        if (response == null || response.isBlank()) {
            return;
        }
        try {
            JsonNode tickets = objectMapper.readTree(response).path("data");
            if (!tickets.isArray()) {
                return;
            }
            for (JsonNode ticket : tickets) {
                if ("error".equals(ticket.path("status").asText())) {
                    logger.warn("Expo rejected a new-request push notification: {}",
                            ticket.path("message").asText("No error message returned"));
                }
            }
        } catch (JsonProcessingException exception) {
            logger.warn("Could not parse Expo push notification response", exception);
        }
    }
}
